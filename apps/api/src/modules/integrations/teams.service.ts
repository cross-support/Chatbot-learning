import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Teamsメッセージ送信
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
        throw new Error(`Teams API error: ${response.status} - ${errorText}`);
      }

      this.logger.log('Teams message sent successfully');
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to send Teams message', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  /**
   * 通知送信（Adaptive Cardフォーマット）
   */
  async sendNotification(
    webhookUrl: string,
    title: string,
    message: string,
    options?: {
      color?: string;
      facts?: Array<{ title: string; value: string }>;
    },
  ) {
    const card = {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: title,
      themeColor: options?.color || '0078D7',
      sections: [
        {
          activityTitle: title,
          activitySubtitle: 'Chatbot System',
          activityImage:
            'https://adaptivecards.io/content/cats/1.png', // Replace with your logo
          facts: options?.facts || [],
          text: message,
        },
      ],
    };

    return this.sendMessage(webhookUrl, '', card);
  }

  /**
   * 会話開始通知
   */
  async notifyConversationStarted(conversationId: string, userName?: string) {
    const config = await this.getTeamsConfig();
    if (!config || !config.webhookUrl) {
      this.logger.debug('Teams webhook not configured');
      return;
    }

    await this.sendNotification(
      config.webhookUrl,
      'New Conversation Started',
      `A new conversation has been initiated${userName ? ` by ${userName}` : ''}.`,
      {
        color: '2196F3',
        facts: [
          {
            title: 'Conversation ID',
            value: conversationId,
          },
          {
            title: 'User',
            value: userName || 'Anonymous',
          },
        ],
      },
    );
  }

  /**
   * オペレーター要求通知
   */
  async notifyOperatorRequested(conversationId: string, userName?: string, message?: string) {
    const config = await this.getTeamsConfig();
    if (!config || !config.webhookUrl) {
      this.logger.debug('Teams webhook not configured');
      return;
    }

    await this.sendNotification(
      config.webhookUrl,
      'Operator Requested',
      `User is requesting to speak with an operator.`,
      {
        color: 'FF9800',
        facts: [
          {
            title: 'Conversation ID',
            value: conversationId,
          },
          {
            title: 'User',
            value: userName || 'Anonymous',
          },
          {
            title: 'Message',
            value: message || 'No message provided',
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
    const config = await this.getTeamsConfig();
    if (!config || !config.webhookUrl) {
      this.logger.debug('Teams webhook not configured');
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
        color: '4CAF50',
        facts: [
          {
            title: 'Conversation ID',
            value: conversationId,
          },
          {
            title: 'User',
            value: userName || 'Anonymous',
          },
          {
            title: 'Duration',
            value: durationText,
          },
        ],
      },
    );
  }

  /**
   * Teams設定取得
   */
  private async getTeamsConfig(): Promise<{
    webhookUrl: string;
    channel?: string;
  } | null> {
    const config = await this.prisma.notificationConfig.findFirst({
      where: {
        type: 'teams',
        isEnabled: true,
      },
    });

    if (!config) {
      return null;
    }

    return config.config as any;
  }
}
