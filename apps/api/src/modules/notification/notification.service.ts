import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface ConversationWithUser {
  id: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  metadata?: unknown;
}

@Injectable()
export class NotificationService {
  private logger = new Logger('NotificationService');

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {}

  /**
   * 新規リクエスト通知（オペレーター待ち）
   */
  async notifyNewRequest(conversation: ConversationWithUser): Promise<void> {
    const enableSlack = this.configService.get('ENABLE_SLACK_NOTIFICATION') === 'true';

    if (enableSlack) {
      await this.notifySlack(conversation);
    }

    // 将来的にメール通知も追加
    // const enableEmail = this.configService.get('ENABLE_EMAIL_NOTIFICATION') === 'true';
    // if (enableEmail) {
    //   await this.notifyEmail(conversation);
    // }
  }

  /**
   * Slack通知
   */
  async notifySlack(conversation: ConversationWithUser): Promise<void> {
    const webhookUrl = this.configService.get<string>('SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      this.logger.warn('Slack Webhook URLが設定されていません');
      return;
    }

    const adminUrl = this.configService.get<string>('ADMIN_URL') || 'http://localhost:5173';
    const chatUrl = `${adminUrl}/chat/${conversation.id}`;

    const metadata = (conversation.metadata || {}) as { url?: string; title?: string };
    const userName = conversation.user?.name || '未設定';
    const currentPage = metadata.title || metadata.url || '不明';

    const payload = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🔔 新規チャットリクエスト',
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*ユーザー名:*\n${userName}`,
            },
            {
              type: 'mrkdwn',
              text: `*現在のページ:*\n${currentPage}`,
            },
          ],
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: '対応する',
                emoji: true,
              },
              style: 'primary',
              url: chatUrl,
            },
          ],
        },
      ],
    };

    try {
      await firstValueFrom(this.httpService.post(webhookUrl, payload));
      this.logger.log(`Slack通知送信: conversation ${conversation.id}`);
    } catch (error) {
      this.logger.error('Slack通知エラー:', error);
    }
  }

  /**
   * 営業時間内かどうかチェック
   */
  isBusinessHours(): boolean {
    const now = new Date();
    const hours = now.getHours();
    const day = now.getDay();

    // 土日（0=日曜, 6=土曜）
    if (day === 0 || day === 6) {
      return false;
    }

    // 平日 9:00-18:00
    return hours >= 9 && hours < 18;
  }

  /**
   * オフラインメッセージを送信
   */
  async sendOfflineMessage(conversation: ConversationWithUser): Promise<string> {
    if (this.isBusinessHours()) {
      return '現在オペレーターに接続中です。少々お待ちください。';
    }

    return '現在オペレーター対応時間外です。\n【対応時間】平日 9:00〜18:00\nお急ぎの場合は、お問い合わせフォームよりご連絡ください。';
  }
}
