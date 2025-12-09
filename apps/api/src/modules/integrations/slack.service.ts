import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Slackメッセージ送信
   */
  async sendMessage(webhookUrl: string, message: string, options?: any) {
    try {
      const payload = {
        text: message,
        ...options,
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slack API error: ${response.status} - ${errorText}`);
      }

      this.logger.log('Slack message sent successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to send Slack message', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /**
   * 通知送信（リッチフォーマット）
   */
  async sendNotification(
    webhookUrl: string,
    title: string,
    message: string,
    options?: {
      color?: string;
      fields?: Array<{ title: string; value: string; short?: boolean }>;
      footer?: string;
      timestamp?: number;
    },
  ) {
    const attachment = {
      color: options?.color || '#36a64f',
      title,
      text: message,
      fields: options?.fields || [],
      footer: options?.footer || 'Chatbot System',
      ts: options?.timestamp || Math.floor(Date.now() / 1000),
    };

    return this.sendMessage(webhookUrl, '', {
      attachments: [attachment],
    });
  }

  /**
   * 会話開始通知
   */
  async notifyConversationStarted(conversationId: string, userName?: string) {
    const config = await this.getSlackConfig();
    if (!config || !config.webhookUrl) {
      this.logger.debug('Slack webhook not configured');
      return;
    }

    await this.sendNotification(
      config.webhookUrl,
      'New Conversation Started',
      `A new conversation has been initiated${userName ? ` by ${userName}` : ''}.`,
      {
        color: '#2196F3',
        fields: [
          {
            title: 'Conversation ID',
            value: conversationId,
            short: true,
          },
          {
            title: 'User',
            value: userName || 'Anonymous',
            short: true,
          },
        ],
      },
    );
  }

  /**
   * オペレーター要求通知
   */
  async notifyOperatorRequested(conversationId: string, userName?: string, message?: string) {
    const config = await this.getSlackConfig();
    if (!config || !config.webhookUrl) {
      this.logger.debug('Slack webhook not configured');
      return;
    }

    await this.sendNotification(
      config.webhookUrl,
      'Operator Requested',
      `User is requesting to speak with an operator.`,
      {
        color: '#FF9800',
        fields: [
          {
            title: 'Conversation ID',
            value: conversationId,
            short: true,
          },
          {
            title: 'User',
            value: userName || 'Anonymous',
            short: true,
          },
          {
            title: 'Message',
            value: message || 'No message provided',
            short: false,
          },
        ],
      },
    );
  }

  /**
   * チャット終了通知
   */
  async notifyConversationClosed(
    conversationId: string,
    userName?: string,
    duration?: number,
  ) {
    const config = await this.getSlackConfig();
    if (!config || !config.webhookUrl) {
      this.logger.debug('Slack webhook not configured');
      return;
    }

    const durationText = duration
      ? `${Math.floor(duration / 60)} minutes ${duration % 60} seconds`
      : 'Unknown';

    await this.sendNotification(
      config.webhookUrl,
      'Conversation Closed',
      `A conversation has been closed.`,
      {
        color: '#4CAF50',
        fields: [
          {
            title: 'Conversation ID',
            value: conversationId,
            short: true,
          },
          {
            title: 'User',
            value: userName || 'Anonymous',
            short: true,
          },
          {
            title: 'Duration',
            value: durationText,
            short: true,
          },
        ],
      },
    );
  }

  /**
   * Slack設定取得
   */
  private async getSlackConfig(): Promise<{
    webhookUrl: string;
    channel?: string;
  } | null> {
    const config = await this.prisma.notificationConfig.findFirst({
      where: {
        type: 'slack',
        isEnabled: true,
      },
    });

    if (!config) {
      return null;
    }

    return config.config as any;
  }
}
