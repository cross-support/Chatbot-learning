import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    authenticator.options = {
      window: 1, // 前後1ステップを許容
    };
  }

  /**
   * 2FA設定を生成
   */
  async generateSecret(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new BadRequestException('管理者が見つかりません');
    }

    const secret = authenticator.generateSecret();
    const appName = this.configService.get('APP_NAME', 'CrossBot');
    const otpauthUrl = authenticator.keyuri(admin.email, appName, secret);

    // QRコードを生成
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // バックアップコードを生成
    const backupCodes = this.generateBackupCodes();

    // 暗号化して保存（verifiedAtはnullのまま）
    await this.prisma.twoFactorAuth.upsert({
      where: { adminId },
      create: {
        adminId,
        secret: this.encryptSecret(secret),
        backupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
        isEnabled: false,
      },
      update: {
        secret: this.encryptSecret(secret),
        backupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
        isEnabled: false,
        verifiedAt: null,
      },
    });

    return {
      qrCode: qrCodeDataUrl,
      secret,
      backupCodes,
    };
  }

  /**
   * 2FAを有効化（初回認証）
   */
  async enableTwoFactor(adminId: string, token: string) {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (!twoFactor) {
      throw new BadRequestException('2FA設定が見つかりません。先に設定を生成してください');
    }

    const secret = this.decryptSecret(twoFactor.secret);
    const isValid = authenticator.verify({ token, secret });

    if (!isValid) {
      throw new BadRequestException('無効な認証コードです');
    }

    await this.prisma.twoFactorAuth.update({
      where: { adminId },
      data: {
        isEnabled: true,
        verifiedAt: new Date(),
      },
    });

    this.logger.log(`2FA enabled for admin: ${adminId}`);
    return { success: true, message: '2FAが有効になりました' };
  }

  /**
   * 2FAを無効化
   */
  async disableTwoFactor(adminId: string, token: string) {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      throw new BadRequestException('2FAは有効になっていません');
    }

    const isValid = await this.verifyToken(adminId, token);
    if (!isValid) {
      throw new BadRequestException('無効な認証コードです');
    }

    await this.prisma.twoFactorAuth.update({
      where: { adminId },
      data: {
        isEnabled: false,
        verifiedAt: null,
      },
    });

    this.logger.log(`2FA disabled for admin: ${adminId}`);
    return { success: true, message: '2FAが無効になりました' };
  }

  /**
   * TOTPトークンを検証
   */
  async verifyToken(adminId: string, token: string): Promise<boolean> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return true; // 2FAが無効なら検証なしでOK
    }

    const secret = this.decryptSecret(twoFactor.secret);
    return authenticator.verify({ token, secret });
  }

  /**
   * バックアップコードで認証
   */
  async verifyBackupCode(adminId: string, code: string): Promise<boolean> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return true;
    }

    const hashedCode = this.hashBackupCode(code);
    const codeIndex = twoFactor.backupCodes.findIndex((c) => c === hashedCode);

    if (codeIndex === -1) {
      return false;
    }

    // 使用済みコードを削除
    const updatedCodes = [...twoFactor.backupCodes];
    updatedCodes.splice(codeIndex, 1);

    await this.prisma.twoFactorAuth.update({
      where: { adminId },
      data: { backupCodes: updatedCodes },
    });

    this.logger.log(`Backup code used for admin: ${adminId}`);
    return true;
  }

  /**
   * 2FAステータスを取得
   */
  async getTwoFactorStatus(adminId: string) {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    return {
      isEnabled: twoFactor?.isEnabled ?? false,
      verifiedAt: twoFactor?.verifiedAt,
      backupCodesRemaining: twoFactor?.backupCodes.length ?? 0,
    };
  }

  /**
   * バックアップコードを再生成
   */
  async regenerateBackupCodes(adminId: string, token: string) {
    const isValid = await this.verifyToken(adminId, token);
    if (!isValid) {
      throw new BadRequestException('無効な認証コードです');
    }

    const backupCodes = this.generateBackupCodes();

    await this.prisma.twoFactorAuth.update({
      where: { adminId },
      data: {
        backupCodes: backupCodes.map((code) => this.hashBackupCode(code)),
      },
    });

    return { backupCodes };
  }

  /**
   * 2FAが必要かチェック
   */
  async requiresTwoFactor(adminId: string): Promise<boolean> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    return twoFactor?.isEnabled ?? false;
  }

  // ===== プライベートメソッド =====

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  private hashBackupCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private encryptSecret(secret: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decryptSecret(encryptedSecret: string): string {
    const key = this.getEncryptionKey();
    const [ivHex, encrypted] = encryptedSecret.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get('ENCRYPTION_SECRET', 'default-secret-key-change-in-production!');
    return crypto.createHash('sha256').update(secret).digest();
  }
}
