import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(private prisma: PrismaService) {}

  private generateApiKey(): { key: string; hash: string; prefix: string } {
    // cb_で始まる32文字のランダムなAPIキー
    const randomBytes = crypto.randomBytes(24).toString('base64url');
    const key = `cb_${randomBytes}`;
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const prefix = `cb_${randomBytes.slice(0, 8)}...`;
    return { key, hash, prefix };
  }

  async create(name: string, permissions?: Record<string, unknown>, expiresAt?: Date) {
    const { key, hash, prefix } = this.generateApiKey();

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name,
        key: hash,
        keyPrefix: prefix,
        permissions: permissions as object | undefined,
        expiresAt,
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

    // 作成時のみ実際のキーを返す
    return {
      ...apiKey,
      key, // 一度だけ表示
    };
  }

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

  async findById(id: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id },
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

    if (!apiKey) {
      throw new NotFoundException('APIキーが見つかりません');
    }

    return apiKey;
  }

  async validateKey(key: string): Promise<{ valid: boolean; apiKey?: { id: string; permissions: unknown } }> {
    const hash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key: hash },
      select: {
        id: true,
        isActive: true,
        expiresAt: true,
        permissions: true,
      },
    });

    if (!apiKey || !apiKey.isActive) {
      return { valid: false };
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false };
    }

    // 最終使用日時を更新
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { valid: true, apiKey: { id: apiKey.id, permissions: apiKey.permissions } };
  }

  async update(id: string, data: { name?: string; permissions?: Record<string, unknown>; isActive?: boolean }) {
    await this.findById(id); // 存在確認

    return this.prisma.apiKey.update({
      where: { id },
      data: {
        name: data.name,
        permissions: data.permissions as object | undefined,
        isActive: data.isActive,
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

  async delete(id: string) {
    await this.findById(id); // 存在確認
    await this.prisma.apiKey.delete({ where: { id } });
    return { success: true };
  }

  async regenerate(id: string) {
    await this.findById(id); // 存在確認
    const { key, hash, prefix } = this.generateApiKey();

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
      key, // 再生成時のみ実際のキーを返す
    };
  }
}
