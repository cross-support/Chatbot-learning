import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  /**
   * APIキーを生成
   */
  private generateApiKey(): { key: string; prefix: string; hash: string } {
    // ランダムなAPIキーを生成（32バイト = 64文字の16進数）
    const rawKey = crypto.randomBytes(32).toString('hex');
    const prefix = `cb_${rawKey.substring(0, 8)}...`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

    return {
      key: `cb_${rawKey}`,
      prefix,
      hash,
    };
  }

  /**
   * APIキー一覧取得
   */
  async findAll() {
    return this.prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * APIキーを作成
   */
  async create(data: {
    name: string;
    permissions?: string[];
    expiresAt?: Date;
  }) {
    const { key, prefix, hash } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: data.name,
        key: hash,
        keyPrefix: prefix,
        permissions: data.permissions || ['read'],
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // 生成されたキーは一度だけ返す（平文で保存しないため）
    return {
      ...apiKey,
      key, // 平文のキーを返す（この1回限り）
    };
  }

  /**
   * APIキーを更新
   */
  async update(id: string, data: {
    name?: string;
    permissions?: string[];
    isActive?: boolean;
    expiresAt?: Date | null;
  }) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('APIキーが見つかりません');
    }

    return this.prisma.apiKey.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.permissions !== undefined && { permissions: data.permissions }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * APIキーを削除
   */
  async delete(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('APIキーが見つかりません');
    }

    await this.prisma.apiKey.delete({ where: { id } });
    return { message: 'APIキーを削除しました' };
  }

  /**
   * APIキーを再生成
   */
  async regenerate(id: string) {
    const existing = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('APIキーが見つかりません');
    }

    const { key, prefix, hash } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        key: hash,
        keyPrefix: prefix,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        isActive: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      ...apiKey,
      key, // 新しい平文のキーを返す
    };
  }

  /**
   * APIキーを検証
   */
  async validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    permissions?: string[];
  }> {
    if (!apiKey.startsWith('cb_')) {
      return { valid: false };
    }

    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const key = await this.prisma.apiKey.findUnique({
      where: { key: hash },
    });

    if (!key) {
      return { valid: false };
    }

    // アクティブチェック
    if (!key.isActive) {
      return { valid: false };
    }

    // 有効期限チェック
    if (key.expiresAt && key.expiresAt < new Date()) {
      return { valid: false };
    }

    // 最終使用日時を更新
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      permissions: (key.permissions as string[]) || ['read'],
    };
  }
}
