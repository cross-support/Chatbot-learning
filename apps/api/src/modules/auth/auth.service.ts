import { Injectable, UnauthorizedException, BadRequestException, Inject, Scope } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SessionService } from '../../common/services/session.service';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

export interface PasswordPolicyConfig {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  passwordExpiryDays: number;
}

const DEFAULT_PASSWORD_POLICY: PasswordPolicyConfig = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  passwordExpiryDays: 90,
};

@Injectable({ scope: Scope.REQUEST })
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    @Inject(REQUEST) private request: Request,
  ) {}

  private async getPasswordPolicy(): Promise<PasswordPolicyConfig> {
    const policy = await this.prisma.passwordPolicy.findFirst();
    return policy || DEFAULT_PASSWORD_POLICY;
  }

  validatePassword(password: string, policy: PasswordPolicyConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < policy.minLength) {
      errors.push(`パスワードは${policy.minLength}文字以上にしてください`);
    }
    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('大文字を1文字以上含めてください');
    }
    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('小文字を1文字以上含めてください');
    }
    if (policy.requireNumbers && !/[0-9]/.test(password)) {
      errors.push('数字を1文字以上含めてください');
    }
    if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('特殊文字を1文字以上含めてください');
    }

    return { valid: errors.length === 0, errors };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    const policy = await this.getPasswordPolicy();

    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('メールアドレスまたはパスワードが正しくありません');
    }

    // アカウントロックチェック
    if (admin.isLocked) {
      if (admin.lockedUntil && admin.lockedUntil > new Date()) {
        const remainingMinutes = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 60000);
        throw new UnauthorizedException(
          `アカウントがロックされています。${remainingMinutes}分後に再試行してください。`
        );
      }
      // ロック期間が過ぎた場合、ロックを解除
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { isLocked: false, loginAttempts: 0, lockedUntil: null },
      });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      // ログイン失敗回数を増加
      const newAttempts = admin.loginAttempts + 1;
      const shouldLock = newAttempts >= policy.maxLoginAttempts;

      await this.prisma.admin.update({
        where: { id: admin.id },
        data: {
          loginAttempts: newAttempts,
          isLocked: shouldLock,
          lockedUntil: shouldLock
            ? new Date(Date.now() + policy.lockoutDurationMinutes * 60000)
            : null,
        },
      });

      if (shouldLock) {
        throw new UnauthorizedException(
          `ログイン試行回数が上限を超えました。${policy.lockoutDurationMinutes}分間ロックされます。`
        );
      }

      const remainingAttempts = policy.maxLoginAttempts - newAttempts;
      throw new UnauthorizedException(
        `メールアドレスまたはパスワードが正しくありません（残り${remainingAttempts}回）`
      );
    }

    // パスワード有効期限チェック
    let passwordExpired = false;
    if (admin.lastPasswordChangeAt && policy.passwordExpiryDays > 0) {
      const expiryDate = new Date(admin.lastPasswordChangeAt);
      expiryDate.setDate(expiryDate.getDate() + policy.passwordExpiryDays);
      passwordExpired = expiryDate < new Date();
    }

    // 2FAが有効かチェック
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId: admin.id },
    });

    if (twoFactorAuth && twoFactorAuth.isEnabled) {
      // 2FAが有効な場合、ログイン試行回数のみリセット
      await this.prisma.admin.update({
        where: { id: admin.id },
        data: { loginAttempts: 0 },
      });

      // 2FA検証が必要であることを返す
      return {
        requires2FA: true,
        email: admin.email,
        passwordExpired,
        message: '2段階認証が必要です',
      };
    }

    // 2FAが無効な場合は通常のログイン処理
    // ログイン成功：試行回数をリセット、ステータスをオンラインに更新
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { status: 'ONLINE', loginAttempts: 0 },
    });

    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const accessToken = this.jwtService.sign(payload);

    await this.sessionService.createSession({
      adminId: admin.id,
      token: accessToken,
      ipAddress: this.request.ip,
      userAgent: this.request.get('user-agent'),
    });

    return {
      requires2FA: false,
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: 'ONLINE',
      },
      passwordExpired,
    };
  }

  async logout(adminId: string, token: string) {
    await this.prisma.admin.update({
      where: { id: adminId },
      data: { status: 'OFFLINE' },
    });

    await this.sessionService.deleteSession(token);

    return { message: 'ログアウトしました' };
  }

  async getMe(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        maxConcurrent: true,
        createdAt: true,
      },
    });

    if (!admin) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    return admin;
  }

  async createAdmin(createAdminDto: CreateAdminDto) {
    const { email, password, name, role } = createAdminDto;
    const policy = await this.getPasswordPolicy();

    // パスワードポリシーチェック
    const validation = this.validatePassword(password, policy);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const existingAdmin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (existingAdmin) {
      throw new UnauthorizedException('このメールアドレスは既に登録されています');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        email,
        passwordHash,
        name,
        role: role || 'OPERATOR',
        lastPasswordChangeAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return admin;
  }

  async changePassword(adminId: string, currentPassword: string, newPassword: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('現在のパスワードが正しくありません');
    }

    const policy = await this.getPasswordPolicy();
    const validation = this.validatePassword(newPassword, policy);
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.admin.update({
      where: { id: adminId },
      data: {
        passwordHash,
        lastPasswordChangeAt: new Date(),
      },
    });

    return { message: 'パスワードを変更しました' };
  }

  async getPasswordPolicySettings() {
    return this.getPasswordPolicy();
  }

  async updatePasswordPolicy(policy: Partial<PasswordPolicyConfig>) {
    const existing = await this.prisma.passwordPolicy.findFirst();

    if (existing) {
      return this.prisma.passwordPolicy.update({
        where: { id: existing.id },
        data: policy,
      });
    }

    return this.prisma.passwordPolicy.create({
      data: { ...DEFAULT_PASSWORD_POLICY, ...policy },
    });
  }

  async unlockAdmin(adminId: string) {
    return this.prisma.admin.update({
      where: { id: adminId },
      data: {
        isLocked: false,
        loginAttempts: 0,
        lockedUntil: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isLocked: true,
      },
    });
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return payload;
    } catch {
      throw new UnauthorizedException('無効なトークンです');
    }
  }

  /**
   * 2FA設定開始（QRコード生成）
   */
  async setup2FA(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    // 既存の2FA設定をチェック
    const existing2FA = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (existing2FA && existing2FA.isEnabled) {
      throw new BadRequestException('2FAは既に有効になっています');
    }

    // TOTP秘密鍵を生成
    const secret = speakeasy.generateSecret({
      name: `Chatbot (${admin.email})`,
      issuer: 'Chatbot System',
    });

    // バックアップコードを生成
    const backupCodes = Array.from({ length: 10 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase(),
    );

    // バックアップコードをハッシュ化して保存
    const hashedBackupCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, 10)),
    );

    // QRコードを生成
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // 2FA設定を保存（まだ無効状態）
    if (existing2FA) {
      await this.prisma.twoFactorAuth.update({
        where: { id: existing2FA.id },
        data: {
          secret: secret.base32,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
          verifiedAt: null,
        },
      });
    } else {
      await this.prisma.twoFactorAuth.create({
        data: {
          adminId,
          secret: secret.base32,
          backupCodes: hashedBackupCodes,
          isEnabled: false,
        },
      });
    }

    return {
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      backupCodes, // 平文のバックアップコードを返す（1回のみ）
    };
  }

  /**
   * 2FA検証
   */
  async verify2FA(adminId: string, token: string) {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (!twoFactorAuth) {
      throw new BadRequestException('2FAが設定されていません');
    }

    // TOTPトークンを検証
    const verified = speakeasy.totp.verify({
      secret: twoFactorAuth.secret,
      encoding: 'base32',
      token,
      window: 2, // 前後2回分のトークンを許容
    });

    if (!verified) {
      throw new UnauthorizedException('無効な認証コードです');
    }

    // 検証成功：2FAを有効化
    await this.prisma.twoFactorAuth.update({
      where: { id: twoFactorAuth.id },
      data: {
        isEnabled: true,
        verifiedAt: new Date(),
      },
    });

    return {
      message: '2FAが有効になりました',
      enabled: true,
    };
  }

  /**
   * 2FA無効化
   */
  async disable2FA(adminId: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    // パスワード確認
    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('パスワードが正しくありません');
    }

    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
      throw new BadRequestException('2FAは有効になっていません');
    }

    // 2FAを無効化
    await this.prisma.twoFactorAuth.update({
      where: { id: twoFactorAuth.id },
      data: {
        isEnabled: false,
      },
    });

    return {
      message: '2FAを無効にしました',
      enabled: false,
    };
  }

  /**
   * ログイン時の2FA検証
   */
  async verify2FALogin(email: string, token: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email },
    });

    if (!admin) {
      throw new UnauthorizedException('ユーザーが見つかりません');
    }

    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId: admin.id },
    });

    if (!twoFactorAuth || !twoFactorAuth.isEnabled) {
      throw new BadRequestException('2FAが有効になっていません');
    }

    // TOTPトークンを検証
    const verified = speakeasy.totp.verify({
      secret: twoFactorAuth.secret,
      encoding: 'base32',
      token,
      window: 2,
    });

    // TOTPが失敗した場合、バックアップコードをチェック
    let isBackupCode = false;
    if (!verified) {
      isBackupCode = await this.verifyBackupCode(twoFactorAuth.id, token);
      if (!isBackupCode) {
        throw new UnauthorizedException('無効な認証コードです');
      }
    }

    // ログイン成功：ステータスをオンラインに更新
    await this.prisma.admin.update({
      where: { id: admin.id },
      data: { status: 'ONLINE', loginAttempts: 0 },
    });

    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const accessToken = this.jwtService.sign(payload);

    // セッションを作成
    await this.sessionService.createSession({
      adminId: admin.id,
      token: accessToken,
      ipAddress: this.request.ip,
      userAgent: this.request.get('user-agent'),
    });

    return {
      accessToken,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        status: 'ONLINE',
      },
      usedBackupCode: isBackupCode,
    };
  }

  /**
   * バックアップコード検証
   */
  private async verifyBackupCode(twoFactorAuthId: string, code: string): Promise<boolean> {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { id: twoFactorAuthId },
    });

    if (!twoFactorAuth || !twoFactorAuth.backupCodes) {
      return false;
    }

    // バックアップコードを1つずつ検証
    for (let i = 0; i < twoFactorAuth.backupCodes.length; i++) {
      const isMatch = await bcrypt.compare(code, twoFactorAuth.backupCodes[i]);
      if (isMatch) {
        // 使用済みのバックアップコードを削除
        const updatedBackupCodes = twoFactorAuth.backupCodes.filter((_, index) => index !== i);
        await this.prisma.twoFactorAuth.update({
          where: { id: twoFactorAuthId },
          data: { backupCodes: updatedBackupCodes },
        });
        return true;
      }
    }

    return false;
  }

  /**
   * 2FA有効状態をチェック
   */
  async check2FAStatus(adminId: string) {
    const twoFactorAuth = await this.prisma.twoFactorAuth.findUnique({
      where: { adminId },
    });

    return {
      enabled: twoFactorAuth?.isEnabled || false,
      verifiedAt: twoFactorAuth?.verifiedAt,
    };
  }
}
