import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  constructor(private configService: ConfigService) {}

  /**
   * データを暗号化
   */
  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // IV + AuthTag + 暗号文を結合
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * データを復号化
   */
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');

    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * オブジェクトの特定フィールドを暗号化
   */
  encryptFields<T extends Record<string, unknown>>(
    data: T,
    fieldsToEncrypt: (keyof T)[],
  ): T {
    const result = { ...data };
    for (const field of fieldsToEncrypt) {
      if (result[field] && typeof result[field] === 'string') {
        result[field] = this.encrypt(result[field] as string) as T[keyof T];
      }
    }
    return result;
  }

  /**
   * オブジェクトの特定フィールドを復号化
   */
  decryptFields<T extends Record<string, unknown>>(
    data: T,
    fieldsToDecrypt: (keyof T)[],
  ): T {
    const result = { ...data };
    for (const field of fieldsToDecrypt) {
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = this.decrypt(result[field] as string) as T[keyof T];
        } catch (error) {
          this.logger.warn(`Failed to decrypt field ${String(field)}`);
        }
      }
    }
    return result;
  }

  /**
   * ハッシュを生成（検索用・不可逆）
   */
  hash(data: string): string {
    const salt = this.configService.get('HASH_SALT', 'default-salt');
    return crypto.createHmac('sha256', salt).update(data).digest('hex');
  }

  /**
   * 部分マスク（例: メールアドレス）
   */
  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;

    const maskedLocal =
      local.length <= 2
        ? '*'.repeat(local.length)
        : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];

    return `${maskedLocal}@${domain}`;
  }

  /**
   * 部分マスク（例: 電話番号）
   */
  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return '*'.repeat(digits.length);

    return '*'.repeat(digits.length - 4) + digits.slice(-4);
  }

  /**
   * 個人情報を含むデータを安全に保存するための暗号化
   */
  encryptPII(data: {
    email?: string;
    phone?: string;
    name?: string;
    company?: string;
  }): {
    encrypted: Record<string, string>;
    searchHashes: Record<string, string>;
    masked: Record<string, string>;
  } {
    const encrypted: Record<string, string> = {};
    const searchHashes: Record<string, string> = {};
    const masked: Record<string, string> = {};

    if (data.email) {
      encrypted.email = this.encrypt(data.email);
      searchHashes.emailHash = this.hash(data.email.toLowerCase());
      masked.email = this.maskEmail(data.email);
    }

    if (data.phone) {
      encrypted.phone = this.encrypt(data.phone);
      searchHashes.phoneHash = this.hash(data.phone.replace(/\D/g, ''));
      masked.phone = this.maskPhone(data.phone);
    }

    if (data.name) {
      encrypted.name = this.encrypt(data.name);
      masked.name = data.name.length > 1 ? data.name[0] + '*'.repeat(data.name.length - 1) : '*';
    }

    if (data.company) {
      encrypted.company = this.encrypt(data.company);
      masked.company = data.company;
    }

    return { encrypted, searchHashes, masked };
  }

  /**
   * 暗号化されたPIIを復号化
   */
  decryptPII(encrypted: Record<string, string>): Record<string, string> {
    const decrypted: Record<string, string> = {};

    for (const [key, value] of Object.entries(encrypted)) {
      try {
        decrypted[key] = this.decrypt(value);
      } catch {
        this.logger.warn(`Failed to decrypt PII field: ${key}`);
        decrypted[key] = '[復号化エラー]';
      }
    }

    return decrypted;
  }

  /**
   * セキュアなランダムトークンを生成
   */
  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * パスワードをハッシュ化（bcryptの代替としてPBKDF2使用）
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    const iterations = 100000;
    const keylen = 64;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, keylen, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(salt.toString('hex') + ':' + derivedKey.toString('hex'));
      });
    });
  }

  /**
   * パスワードを検証
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [saltHex, storedHash] = hash.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const iterations = 100000;
    const keylen = 64;

    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, keylen, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex') === storedHash);
      });
    });
  }

  // ===== プライベートメソッド =====

  private getEncryptionKey(): Buffer {
    const secret = this.configService.get(
      'ENCRYPTION_SECRET',
      'default-secret-key-change-in-production!',
    );
    return crypto.createHash('sha256').update(secret).digest();
  }
}
