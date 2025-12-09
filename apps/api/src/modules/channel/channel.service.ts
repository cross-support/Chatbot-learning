import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../encryption/encryption.service';
import { Prisma } from '@prisma/client';

interface LineConfig {
  channelAccessToken: string;
  channelSecret: string;
}

interface SlackConfig {
  botToken: string;
  signingSecret: string;
  appId?: string;
}

type ChannelCredentials = LineConfig | SlackConfig;

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * チャネル設定を作成/更新
   */
  async upsertChannelConfig(
    channelType: 'line' | 'slack' | 'teams' | 'facebook',
    credentials: ChannelCredentials,
    config?: Record<string, unknown>,
  ) {
    // 認証情報を暗号化
    const encryptedCredentials = this.encryptCredentials(credentials);

    return this.prisma.channelConfig.upsert({
      where: { channelType },
      create: {
        channelType,
        credentials: encryptedCredentials as Prisma.InputJsonValue,
        config: (config || {}) as Prisma.InputJsonValue,
        isEnabled: false,
      },
      update: {
        credentials: encryptedCredentials as Prisma.InputJsonValue,
        config: (config || {}) as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * チャネル設定を取得
   */
  async getChannelConfig(channelType: string) {
    const config = await this.prisma.channelConfig.findUnique({
      where: { channelType },
    });

    if (!config) return null;

    // 認証情報は復号化しない（セキュリティ）
    return {
      id: config.id,
      channelType: config.channelType,
      isEnabled: config.isEnabled,
      config: config.config,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * 全チャネル設定を取得
   */
  async getAllChannelConfigs() {
    const configs = await this.prisma.channelConfig.findMany();

    return configs.map((config) => ({
      id: config.id,
      channelType: config.channelType,
      isEnabled: config.isEnabled,
      config: config.config,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }));
  }

  /**
   * チャネルを有効化/無効化
   */
  async setChannelEnabled(channelType: string, isEnabled: boolean) {
    return this.prisma.channelConfig.update({
      where: { channelType },
      data: { isEnabled },
    });
  }

  /**
   * チャネルユーザーを登録/更新
   */
  async upsertChannelUser(data: {
    channelType: string;
    channelUserId: string;
    userId?: string;
    displayName?: string;
    profileData?: Record<string, unknown>;
  }) {
    return this.prisma.channelUser.upsert({
      where: {
        channelType_channelUserId: {
          channelType: data.channelType,
          channelUserId: data.channelUserId,
        },
      },
      create: {
        channelType: data.channelType,
        channelUserId: data.channelUserId,
        userId: data.userId,
        displayName: data.displayName,
        profileData: (data.profileData || {}) as Prisma.InputJsonValue,
      },
      update: {
        userId: data.userId,
        displayName: data.displayName,
        profileData: data.profileData as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * チャネルユーザーを取得
   */
  async getChannelUser(channelType: string, channelUserId: string) {
    return this.prisma.channelUser.findUnique({
      where: {
        channelType_channelUserId: {
          channelType,
          channelUserId,
        },
      },
    });
  }

  /**
   * ユーザーIDでチャネルユーザーを取得
   */
  async getChannelUsersByUserId(userId: string) {
    return this.prisma.channelUser.findMany({
      where: { userId },
    });
  }

  // ===== LINE連携 =====

  /**
   * LINE Webhookの署名を検証
   */
  async verifyLineSignature(body: string, signature: string): Promise<boolean> {
    const config = await this.prisma.channelConfig.findUnique({
      where: { channelType: 'line' },
    });

    if (!config || !config.isEnabled) {
      return false;
    }

    const credentials = this.decryptCredentials(config.credentials as Record<string, string>) as LineConfig;
    const crypto = await import('crypto');
    const hash = crypto
      .createHmac('sha256', credentials.channelSecret)
      .update(body)
      .digest('base64');

    return hash === signature;
  }

  /**
   * LINEメッセージを送信
   */
  async sendLineMessage(to: string, messages: Array<{ type: string; text?: string; [key: string]: unknown }>) {
    const config = await this.prisma.channelConfig.findUnique({
      where: { channelType: 'line' },
    });

    if (!config || !config.isEnabled) {
      throw new BadRequestException('LINE連携が有効になっていません');
    }

    const credentials = this.decryptCredentials(config.credentials as Record<string, string>) as LineConfig;

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.channelAccessToken}`,
      },
      body: JSON.stringify({ to, messages }),
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`LINE API error: ${error}`);
      throw new Error(`LINE API error: ${response.status}`);
    }

    return { success: true };
  }

  // ===== Slack連携 =====

  /**
   * Slack Webhookの署名を検証
   */
  async verifySlackSignature(
    body: string,
    timestamp: string,
    signature: string,
  ): Promise<boolean> {
    const config = await this.prisma.channelConfig.findUnique({
      where: { channelType: 'slack' },
    });

    if (!config || !config.isEnabled) {
      return false;
    }

    const credentials = this.decryptCredentials(config.credentials as Record<string, string>) as SlackConfig;
    const crypto = await import('crypto');

    const sigBasestring = `v0:${timestamp}:${body}`;
    const hash = 'v0=' + crypto
      .createHmac('sha256', credentials.signingSecret)
      .update(sigBasestring)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }

  /**
   * Slackメッセージを送信
   */
  async sendSlackMessage(channel: string, text: string, blocks?: unknown[]) {
    const config = await this.prisma.channelConfig.findUnique({
      where: { channelType: 'slack' },
    });

    if (!config || !config.isEnabled) {
      throw new BadRequestException('Slack連携が有効になっていません');
    }

    const credentials = this.decryptCredentials(config.credentials as Record<string, string>) as SlackConfig;

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.botToken}`,
      },
      body: JSON.stringify({
        channel,
        text,
        blocks,
      }),
    });

    const result = (await response.json()) as { ok: boolean; error?: string };

    if (!result.ok) {
      this.logger.error(`Slack API error: ${result.error}`);
      throw new Error(`Slack API error: ${result.error}`);
    }

    return result;
  }

  // ===== 統計 =====

  /**
   * チャネル別ユーザー統計
   */
  async getChannelStats() {
    const stats = await this.prisma.channelUser.groupBy({
      by: ['channelType'],
      _count: { id: true },
    });

    return stats.map((s) => ({
      channelType: s.channelType,
      userCount: s._count.id,
    }));
  }

  // ===== プライベートメソッド =====

  private encryptCredentials(credentials: ChannelCredentials): Record<string, string> {
    const encrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string') {
        encrypted[key] = this.encryptionService.encrypt(value);
      }
    }
    return encrypted;
  }

  private decryptCredentials(encrypted: Record<string, string>): ChannelCredentials {
    const decrypted: Record<string, string> = {};
    for (const [key, value] of Object.entries(encrypted)) {
      decrypted[key] = this.encryptionService.decrypt(value);
    }
    return decrypted as unknown as ChannelCredentials;
  }
}
