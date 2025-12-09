import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../prisma/prisma.service';
// TODO: The user needs to install this dependency: pnpm --filter api add @line/bot-sdk
import { Client, ClientConfig, Message, FlexMessage } from '@line/bot-sdk';

export interface ConversationWithUser {
  id: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  metadata?: unknown;
}

export interface MessageForEmail {
  senderType: string;
  content: string;
  createdAt: Date;
}

@Injectable()
export class NotificationService {
  private logger = new Logger('NotificationService');
  private transporter: nodemailer.Transporter | null = null;
  private lineClient: Client | null = null;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
    private prisma: PrismaService,
  ) {
    this.initializeMailTransporter();
    this.initializeLineClient();
  }

  /**
   * メールトランスポーターを初期化
   */
  private initializeMailTransporter() {
    const smtpHost = this.configService.get<string>('SMTP_HOST');
    const smtpPort = this.configService.get<number>('SMTP_PORT') || 587;
    const smtpUser = this.configService.get<string>('SMTP_USER');
    const smtpPass = this.configService.get<string>('SMTP_PASS');

    if (smtpHost && smtpUser && smtpPass) {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });
      this.logger.log('メールトランスポーター初期化完了');
    } else {
      this.logger.warn('SMTP設定が不完全です。メール通知は無効です。');
    }
  }

  /**
   * LINE Bot Clientを初期化
   */
  private initializeLineClient() {
    const channelAccessToken = this.configService.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
    const channelSecret = this.configService.get<string>('LINE_CHANNEL_SECRET');

    if (channelAccessToken && channelSecret) {
      const clientConfig: ClientConfig = {
        channelAccessToken,
        channelSecret,
      };
      this.lineClient = new Client(clientConfig);
      this.logger.log('LINE Bot Client 初期化完了');
    } else {
      this.logger.warn('LINE Bot SDKの設定が不完全です。LINE通知は無効です。');
    }
  }

  /**
   * 新規リクエスト通知（オペレーター待ち）
   */
  async notifyNewRequest(conversation: ConversationWithUser): Promise<void> {
    const enableSlack = this.configService.get('ENABLE_SLACK_NOTIFICATION') === 'true';
    const enableEmail = this.configService.get('ENABLE_EMAIL_NOTIFICATION') === 'true';
    const enableLine = this.configService.get('ENABLE_LINE_NOTIFICATION') === 'true';

    if (enableSlack) {
      await this.notifySlack(conversation);
    }

    if (enableEmail) {
      await this.notifyEmail(conversation);
    }

    if (enableLine) {
      await this.notifyLine(conversation);
    }

    // Chatwork通知（DB設定で有効な場合）
    await this.notifyChatwork(conversation);
  }

  /**
   * メール通知
   */
  async notifyEmail(conversation: ConversationWithUser): Promise<void> {
    const notificationEmail = this.configService.get<string>('NOTIFICATION_EMAIL');

    if (!notificationEmail) {
      this.logger.warn('NOTIFICATION_EMAIL が設定されていません');
      return;
    }

    if (!this.transporter) {
      this.logger.warn('メールトランスポーターが初期化されていません');
      return;
    }

    try {
      // 会話履歴を取得
      const messages = await this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
      });

      const metadata = (conversation.metadata || {}) as { url?: string; title?: string };
      const userName = conversation.user?.name || '未設定';
      const userEmail = conversation.user?.email || '未設定';
      const currentPage = metadata.title || metadata.url || '不明';
      const adminUrl = this.configService.get<string>('ADMIN_URL') || 'http://localhost:5173';
      const chatUrl = `${adminUrl}/rtchat/${conversation.id}`;

      // メッセージ履歴をフォーマット
      const messageHistory = messages.map((msg) => {
        const time = new Date(msg.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
        const sender = this.getSenderLabel(msg.senderType);
        return `[${time}] ${sender}: ${msg.content}`;
      }).join('\n');

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .info-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    .info-table td:first-child { font-weight: bold; width: 120px; color: #6b7280; }
    .messages { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; max-height: none; overflow: visible; }
    .messages pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0; max-height: none; overflow: visible; }
    .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 18px;">🔔 新規チャットリクエスト</h1>
    </div>
    <div class="content">
      <p>オペレーター対応が必要な新しいチャットリクエストがあります。</p>

      <table class="info-table">
        <tr>
          <td>ユーザー名</td>
          <td>${userName}</td>
        </tr>
        <tr>
          <td>メールアドレス</td>
          <td>${userEmail}</td>
        </tr>
        <tr>
          <td>閲覧ページ</td>
          <td>${currentPage}</td>
        </tr>
        <tr>
          <td>リクエスト時刻</td>
          <td>${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
        </tr>
      </table>

      <h3 style="margin-bottom: 10px;">チャット履歴</h3>
      <div class="messages">
        <pre>${messageHistory || 'メッセージはありません'}</pre>
      </div>

      <a href="${chatUrl}" class="button">チャットに対応する</a>
    </div>
    <div class="footer">
      <p>このメールは CrossBot システムから自動送信されています。</p>
    </div>
  </div>
</body>
</html>
`;

      const textContent = `
【新規チャットリクエスト】

オペレーター対応が必要な新しいチャットリクエストがあります。

■ ユーザー情報
・ユーザー名: ${userName}
・メールアドレス: ${userEmail}
・閲覧ページ: ${currentPage}
・リクエスト時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

■ チャット履歴
${messageHistory || 'メッセージはありません'}

■ 対応URL
${chatUrl}

---
このメールは CrossBot システムから自動送信されています。
`;

      const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

      await this.transporter.sendMail({
        from: `"CrossBot 通知" <${fromEmail}>`,
        to: notificationEmail,
        subject: `【CrossBot】新規チャットリクエスト - ${userName}`,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`メール通知送信成功: ${notificationEmail}, conversation: ${conversation.id}`);
    } catch (error) {
      this.logger.error('メール通知エラー:', error);
    }
  }

  /**
   * 送信者タイプのラベルを取得
   */
  private getSenderLabel(senderType: string): string {
    switch (senderType) {
      case 'USER':
        return 'ユーザー';
      case 'ADMIN':
        return 'オペレーター';
      case 'BOT':
        return 'ボット';
      case 'SYSTEM':
        return 'システム';
      default:
        return senderType;
    }
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
    const chatUrl = `${adminUrl}/rtchat/${conversation.id}`;

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
   * LINE通知（LINE Notify または Bot SDK）
   */
  async notifyLine(conversation: ConversationWithUser): Promise<void> {
    const lineSettings = await this.getLineSettings();

    if (!lineSettings || !lineSettings.enabled) {
      this.logger.warn('LINE通知が無効です');
      return;
    }

    const adminUrl = this.configService.get<string>('ADMIN_URL') || 'http://localhost:5173';
    const chatUrl = `${adminUrl}/rtchat/${conversation.id}`;
    const metadata = (conversation.metadata || {}) as { url?: string; title?: string };
    const userName = conversation.user?.name || '未設定';
    const currentPage = metadata.title || metadata.url || '不明';

    // LINE Notify APIを使用（accessTokenがある場合）
    if (lineSettings.accessToken) {
      try {
        const message = `\n【新規チャットリクエスト】\nユーザー名: ${userName}\n閲覧ページ: ${currentPage}\n\n対応URL: ${chatUrl}`;

        await firstValueFrom(
          this.httpService.post(
            'https://notify-api.line.me/api/notify',
            `message=${encodeURIComponent(message)}`,
            {
              headers: {
                'Authorization': `Bearer ${lineSettings.accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            },
          ),
        );

        this.logger.log(`LINE Notify送信成功: conversation ${conversation.id}`);
        return;
      } catch (error) {
        this.logger.error('LINE Notify送信エラー:', error);
        return;
      }
    }

    // LINE Bot SDKを使用（フォールバック）
    if (!this.lineClient || !lineSettings.userId) {
      this.logger.warn('LINE通知が無効、または通知先ユーザーIDが設定されていません');
      return;
    }

    const flexMessage: FlexMessage = {
      type: 'flex',
      altText: '新規チャットリクエスト',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: '新規チャットリクエスト',
              weight: 'bold',
              size: 'md',
              color: '#ffffff',
            },
          ],
          backgroundColor: '#2563EB',
          paddingAll: 'lg',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  contents: [
                    { type: 'text', text: 'ユーザー名', color: '#aaaaaa', size: 'sm', flex: 4 },
                    { type: 'text', text: userName, wrap: true, color: '#666666', size: 'sm', flex: 6 },
                  ],
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  contents: [
                    { type: 'text', text: '閲覧ページ', color: '#aaaaaa', size: 'sm', flex: 4 },
                    { type: 'text', text: currentPage, wrap: true, color: '#666666', size: 'sm', flex: 6 },
                  ],
                },
              ],
            },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: 'チャットに対応する',
                uri: chatUrl,
              },
              style: 'primary',
              height: 'sm',
            },
          ],
          flex: 0,
        },
      },
    };

    try {
      await this.lineClient.pushMessage(lineSettings.userId, flexMessage);
      this.logger.log(`LINE通知送信成功: conversation ${conversation.id}`);
    } catch (error) {
      this.logger.error('LINE通知送信エラー:', error);
    }
  }

  /**
   * Chatwork通知
   */
  async notifyChatwork(conversation: ConversationWithUser): Promise<void> {
    const settings = await this.getChatworkSettings();
    if (!settings || !settings.enabled || !settings.apiToken || !settings.roomId) {
      this.logger.warn('Chatwork設定が不完全です');
      return;
    }

    const adminUrl = this.configService.get<string>('ADMIN_URL') || 'http://localhost:5173';
    const chatUrl = `${adminUrl}/rtchat/${conversation.id}`;

    const metadata = (conversation.metadata || {}) as { url?: string; title?: string };
    const userName = conversation.user?.name || '未設定';
    const currentPage = metadata.title || metadata.url || '不明';

    const message = `[info][title]新規チャットリクエスト[/title]オペレーター対応が必要な新しいチャットリクエストがあります。

■ ユーザー名: ${userName}
■ 現在のページ: ${currentPage}

▼ 対応URL
${chatUrl}[/info]`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://api.chatwork.com/v2/rooms/${settings.roomId}/messages`,
          `body=${encodeURIComponent(message)}`,
          {
            headers: {
              'X-ChatWorkToken': settings.apiToken,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (response.status === 200) {
        this.logger.log(`Chatwork通知送信成功: conversation ${conversation.id}`);
      }
    } catch (error) {
      this.logger.error('Chatwork通知エラー:', error);
    }
  }

  /**
   * フォーム送信をChatworkに通知
   */
  async notifyChatworkFormSubmit(data: {
    formId: string;
    formData: Record<string, unknown>;
    userName?: string;
    userEmail?: string;
    conversationId?: string;
  }): Promise<void> {
    const settings = await this.getChatworkSettings();
    if (!settings || !settings.enabled || !settings.apiToken || !settings.roomId) {
      this.logger.warn('Chatwork設定が不完全です（フォーム通知）');
      return;
    }

    const adminUrl = this.configService.get<string>('ADMIN_URL') || 'http://localhost:5173';
    const chatUrl = data.conversationId ? `${adminUrl}/rtchat/${data.conversationId}` : adminUrl;

    // フォームデータを整形
    const formContent = Object.entries(data.formData)
      .filter(([, value]) => value !== '' && value !== undefined && value !== null)
      .map(([key, value]) => `・${key}: ${value}`)
      .join('\n');

    const message = `[info][title]フォーム送信通知[/title]フォームから問い合わせがありました。

■ フォームID: ${data.formId}
■ 送信者: ${data.userName || '未設定'}
■ メール: ${data.userEmail || '未設定'}
■ 受付日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

【入力内容】
${formContent}

▼ 対応URL
${chatUrl}[/info]`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://api.chatwork.com/v2/rooms/${settings.roomId}/messages`,
          `body=${encodeURIComponent(message)}`,
          {
            headers: {
              'X-ChatWorkToken': settings.apiToken,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (response.status === 200) {
        this.logger.log(`Chatworkフォーム通知送信成功: formId=${data.formId}`);
      }
    } catch (error) {
      this.logger.error('Chatworkフォーム通知エラー:', error);
    }
  }

  /**
   * Chatwork設定を取得
   */
  private async getChatworkSettings(): Promise<{
    enabled: boolean;
    apiToken: string;
    roomId: string;
  } | null> {
    try {
      const setting = await this.prisma.chatSettings.findFirst({
        where: { key: 'notifications' },
      });

      if (!setting || !setting.value) {
        return null;
      }

      const settings = setting.value as Record<string, unknown>;
      return (settings.chatwork as {
        enabled: boolean;
        apiToken: string;
        roomId: string;
      }) || null;
    } catch (error) {
      this.logger.error('Chatwork設定取得エラー:', error);
      return null;
    }
  }
  
  /**
   * LINE設定を取得
   */
  private async getLineSettings(): Promise<{
    enabled: boolean;
    userId?: string;
    accessToken?: string;
  } | null> {
    try {
      const setting = await this.prisma.chatSettings.findFirst({
        where: { key: 'notifications' },
      });

      if (!setting || !setting.value) {
        return null;
      }

      const settings = setting.value as Record<string, unknown>;
      return (settings.line as {
        enabled: boolean;
        userId?: string;
        accessToken?: string;
      }) || null;
    } catch (error) {
      this.logger.error('LINE設定取得エラー:', error);
      return null;
    }
  }

  /**
   * LINEテスト通知を送信（LINE Notify API経由）
   */
  async sendTestLine(userId?: string): Promise<{ success: boolean; error?: string }> {
    // LINE Notifyを使用（設定から取得）
    const lineSettings = await this.getLineSettings();
    const accessToken = lineSettings?.accessToken;

    if (!accessToken) {
      // LINE Bot SDKにフォールバック
      if (!this.lineClient) {
        return { success: false, error: 'LINE通知が設定されていません。LINE Notifyアクセストークンを設定してください。' };
      }

      let toUserId = userId;
      if (!toUserId) {
        toUserId = lineSettings?.userId;
      }

      if (!toUserId) {
        return { success: false, error: '通知先のLINEユーザーIDが設定されていません。' };
      }

      const testMessage: Message = {
        type: 'text',
        text: 'これはCrossBotからのテスト通知です。\nLINE連携が正常に設定されていることを確認しました。',
      };

      try {
        await this.lineClient.pushMessage(toUserId, testMessage);
        this.logger.log(`LINEテスト通知成功 (Bot SDK): ${toUserId}`);
        return { success: true };
      } catch (error) {
        this.logger.error('LINEテスト通知エラー:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'LINE通知の送信に失敗しました',
        };
      }
    }

    // LINE Notify APIを使用
    try {
      const message = 'これはCrossBotからのテスト通知です。\nLINE Notify連携が正常に設定されていることを確認しました。';

      const response = await firstValueFrom(
        this.httpService.post(
          'https://notify-api.line.me/api/notify',
          `message=${encodeURIComponent(message)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (response.status === 200) {
        this.logger.log('LINEテスト通知成功 (LINE Notify)');
        return { success: true };
      } else {
        return { success: false, error: 'LINE Notify APIからエラーが返されました' };
      }
    } catch (error) {
      this.logger.error('LINEテスト通知エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LINE通知の送信に失敗しました',
      };
    }
  }


  /**
   * Chatworkテスト通知を送信
   * @param apiToken フォームから直接渡されるAPIトークン（オプション）
   * @param roomId フォームから直接渡されるルームID（オプション）
   */
  async sendTestChatwork(apiToken?: string, roomId?: string): Promise<{ success: boolean; error?: string }> {
    // フォームから直接渡された値を優先、なければDBから取得
    let token = apiToken;
    let room = roomId;

    if (!token || !room) {
      const settings = await this.getChatworkSettings();
      if (!token) token = settings?.apiToken;
      if (!room) room = settings?.roomId;
    }

    if (!token || !room) {
      return { success: false, error: 'Chatwork APIトークンとルームIDを設定してください' };
    }

    const message = `[info][title]CrossBot テスト通知[/title]これはCrossBotからのテスト通知です。
Chatwork連携が正常に設定されていることを確認しました。

送信日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}[/info]`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `https://api.chatwork.com/v2/rooms/${room}/messages`,
          `body=${encodeURIComponent(message)}`,
          {
            headers: {
              'X-ChatWorkToken': token,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          },
        ),
      );

      if (response.status === 200) {
        return { success: true };
      } else {
        return { success: false, error: 'Chatwork APIからエラーが返されました' };
      }
    } catch (error) {
      this.logger.error('Chatworkテスト通知エラー:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chatwork通知送信に失敗しました',
      };
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

  /**
   * 時間外問い合わせメールを送信
   */
  async sendOffHoursInquiryEmail(data: {
    name: string;
    email: string;
    company: string;
    content: string;
  }): Promise<void> {
    const notificationEmail = this.configService.get<string>('NOTIFICATION_EMAIL');

    if (!notificationEmail) {
      this.logger.warn('NOTIFICATION_EMAIL が設定されていません');
      return;
    }

    if (!this.transporter) {
      this.logger.warn('メールトランスポーターが初期化されていません');
      return;
    }

    try {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .info-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
    .info-table td:first-child { font-weight: bold; width: 120px; color: #6b7280; }
    .inquiry-content { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .inquiry-content pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 18px;">📝 時間外お問い合わせ</h1>
    </div>
    <div class="content">
      <p>営業時間外に以下のお問い合わせがありました。</p>

      <table class="info-table">
        <tr>
          <td>受講者氏名</td>
          <td>${data.name}</td>
        </tr>
        <tr>
          <td>メールアドレス</td>
          <td>${data.email}</td>
        </tr>
        <tr>
          <td>派遣会社</td>
          <td>${data.company}</td>
        </tr>
        <tr>
          <td>受付日時</td>
          <td>${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</td>
        </tr>
      </table>

      <h3 style="margin-bottom: 10px;">問い合わせ内容</h3>
      <div class="inquiry-content">
        <pre>${data.content}</pre>
      </div>
    </div>
    <div class="footer">
      <p>このメールは CrossBot システムから自動送信されています。</p>
    </div>
  </div>
</body>
</html>
`;

      const textContent = `
【時間外お問い合わせ】

営業時間外に以下のお問い合わせがありました。

■ お問い合わせ者情報
・受講者氏名: ${data.name}
・メールアドレス: ${data.email}
・派遣会社: ${data.company}
・受付日時: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}

■ 問い合わせ内容
${data.content}

---
このメールは CrossBot システムから自動送信されています。
`;

      const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

      await this.transporter.sendMail({
        from: `"CrossBot 通知" <${fromEmail}>`,
        to: notificationEmail,
        subject: `【CrossBot】時間外お問い合わせ - ${data.name}`,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`時間外問い合わせメール送信成功: ${notificationEmail}, 送信者: ${data.name}`);
    } catch (error) {
      this.logger.error('時間外問い合わせメール送信エラー:', error);
      throw error;
    }
  }

  /**
   * シナリオからの汎用メール送信（MAILアクション用）
   */
  async sendScenarioMail(config: {
    to?: string;
    toUser?: { name?: string; email?: string };
    subject: string;
    body: string;
    templateId?: string;
    conversationId?: string;
    formData?: Record<string, unknown>;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      this.logger.warn('メールトランスポーターが初期化されていません');
      return { success: false, error: 'メール送信機能が利用できません' };
    }

    try {
      // 宛先の決定
      let toEmail = config.to;
      let toName = '';

      if (!toEmail && config.toUser?.email) {
        toEmail = config.toUser.email;
        toName = config.toUser.name || '';
      }

      // デフォルトは管理者宛て
      if (!toEmail) {
        toEmail = this.configService.get<string>('NOTIFICATION_EMAIL');
      }

      if (!toEmail) {
        return { success: false, error: '送信先メールアドレスが設定されていません' };
      }

      // フォームデータがある場合、本文に追加
      let bodyWithFormData = config.body;
      if (config.formData && Object.keys(config.formData).length > 0) {
        const formDataText = Object.entries(config.formData)
          .filter(([, value]) => value !== '' && value !== undefined && value !== null)
          .map(([key, value]) => `・${key}: ${value}`)
          .join('\n');
        bodyWithFormData += `\n\n【入力内容】\n${formDataText}`;
      }

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .body-text { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .body-text p { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 18px;">${config.subject}</h1>
    </div>
    <div class="content">
      ${toName ? `<p>${toName} 様</p>` : ''}
      <div class="body-text">
        <p>${bodyWithFormData.replace(/\n/g, '<br>')}</p>
      </div>
    </div>
    <div class="footer">
      <p>このメールは CrossBot システムから自動送信されています。</p>
    </div>
  </div>
</body>
</html>
`;

      const textContent = `
${toName ? `${toName} 様\n\n` : ''}${bodyWithFormData}

---
このメールは CrossBot システムから自動送信されています。
`;

      const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

      await this.transporter.sendMail({
        from: `"CrossBot" <${fromEmail}>`,
        to: toEmail,
        subject: config.subject,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`シナリオメール送信成功: ${toEmail}, subject: ${config.subject}`);
      return { success: true };
    } catch (error) {
      this.logger.error('シナリオメール送信エラー:', error);
      return { success: false, error: error instanceof Error ? error.message : 'メール送信に失敗しました' };
    }
  }

  /**
   * 問い合わせへの返信メールを送信
   */
  async sendInquiryReplyEmail(data: {
    toEmail: string;
    toName: string;
    subject: string;
    body: string;
    originalInquiry: string;
  }): Promise<void> {
    if (!this.transporter) {
      this.logger.warn('メールトランスポーターが初期化されていません');
      throw new Error('メール送信機能が利用できません');
    }

    try {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Hiragino Sans', 'Meiryo', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
    .reply-body { background: white; padding: 15px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
    .reply-body p { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
    .original-inquiry { background: #f3f4f6; padding: 15px; border-radius: 8px; border-left: 4px solid #9ca3af; }
    .original-inquiry h4 { margin: 0 0 10px 0; color: #6b7280; font-size: 13px; }
    .original-inquiry p { white-space: pre-wrap; word-wrap: break-word; margin: 0; color: #6b7280; font-size: 13px; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 18px;">お問い合わせへのご回答</h1>
    </div>
    <div class="content">
      <p>${data.toName} 様</p>
      <p>お問い合わせいただきありがとうございます。</p>

      <div class="reply-body">
        <p>${data.body.replace(/\n/g, '<br>')}</p>
      </div>

      <div class="original-inquiry">
        <h4>--- 元のお問い合わせ内容 ---</h4>
        <p>${data.originalInquiry.replace(/\n/g, '<br>')}</p>
      </div>
    </div>
    <div class="footer">
      <p>このメールは CrossBot サポートチームからお送りしています。</p>
      <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
    </div>
  </div>
</body>
</html>
`;

      const textContent = `
${data.toName} 様

お問い合わせいただきありがとうございます。

${data.body}

-------------------------------------------
元のお問い合わせ内容:
${data.originalInquiry}
-------------------------------------------

このメールは CrossBot サポートチームからお送りしています。
ご不明な点がございましたら、お気軽にお問い合わせください。
`;

      const fromEmail = this.configService.get<string>('SMTP_FROM') || this.configService.get<string>('SMTP_USER');

      await this.transporter.sendMail({
        from: `"CrossBot サポート" <${fromEmail}>`,
        to: data.toEmail,
        subject: data.subject,
        text: textContent,
        html: htmlContent,
      });

      this.logger.log(`返信メール送信成功: ${data.toEmail}`);
    } catch (error) {
      this.logger.error('返信メール送信エラー:', error);
      throw error;
    }
  }

  /**
   * CSVデータを生成（CSVアクション用）
   */
  generateCsv(config: {
    headers: string[];
    data: Record<string, unknown>[];
    filename?: string;
  }): { csv: string; filename: string } {
    // ヘッダー行
    const headerRow = config.headers.map(h => this.escapeCsvField(h)).join(',');

    // データ行
    const dataRows = config.data.map(row => {
      return config.headers.map(header => {
        const value = row[header];
        return this.escapeCsvField(String(value ?? ''));
      }).join(',');
    });

    const csv = [headerRow, ...dataRows].join('\n');
    const filename = config.filename || `export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;

    return { csv, filename };
  }

  /**
   * 会話履歴をCSV形式でエクスポート
   */
  async exportConversationToCsv(conversationId: string): Promise<{ csv: string; filename: string }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new Error('会話が見つかりません');
    }

    const headers = ['日時', '送信者', '種別', '内容'];
    const data = conversation.messages.map(msg => ({
      '日時': new Date(msg.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      '送信者': this.getSenderLabel(msg.senderType),
      '種別': msg.contentType,
      '内容': msg.content,
    }));

    const filename = `conversation_${conversationId}_${new Date().toISOString().slice(0, 10)}.csv`;

    return this.generateCsv({ headers, data, filename });
  }

  /**
   * フォームデータをCSV形式でエクスポート
   */
  exportFormDataToCsv(formData: Record<string, unknown>[], formId: string): { csv: string; filename: string } {
    if (formData.length === 0) {
      return { csv: '', filename: `${formId}_empty.csv` };
    }

    // 全てのフォームデータからヘッダーを抽出
    const headersSet = new Set<string>();
    formData.forEach(data => {
      Object.keys(data).forEach(key => headersSet.add(key));
    });
    const headers = Array.from(headersSet);

    const filename = `form_${formId}_${new Date().toISOString().slice(0, 10)}.csv`;

    return this.generateCsv({ headers, data: formData, filename });
  }

  /**
   * CSVフィールドをエスケープ
   */
  private escapeCsvField(field: string): string {
    // ダブルクォート、カンマ、改行を含む場合はダブルクォートで囲む
    if (field.includes('"') || field.includes(',') || field.includes('\n') || field.includes('\r')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }
}
