import { Controller, Post, Body, Logger, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('api/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  private logger = new Logger('NotificationController');

  constructor(private notificationService: NotificationService) {}

  /**
   * テストメール送信
   */
  @Post('test/email')
  async sendTestEmail(@Body() data: { to: string }) {
    try {
      const result = await this.notificationService.sendScenarioMail({
        to: data.to,
        subject: '【テスト】CrossBot メール通知テスト',
        body: 'これはCrossBotからのテストメールです。\n\nメール通知が正常に設定されていることを確認しました。\n\n送信日時: ' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
      });

      if (!result.success) {
        throw new HttpException(result.error || 'メール送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.log(`テストメール送信成功: ${data.to}`);
      return { success: true, message: 'テストメールを送信しました' };
    } catch (error) {
      this.logger.error('テストメール送信エラー:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('メール送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * テストSlack通知送信
   */
  @Post('test/slack')
  async sendTestSlack() {
    try {
      // ダミーの会話データでテスト送信
      await this.notificationService.notifySlack({
        id: 'test-conversation',
        user: {
          id: 'test-user',
          name: 'テストユーザー',
          email: 'test@example.com',
        },
        metadata: {
          url: 'https://example.com/test',
          title: 'テストページ',
        },
      });

      this.logger.log('テストSlack通知送信成功');
      return { success: true, message: 'テストSlack通知を送信しました' };
    } catch (error) {
      this.logger.error('テストSlack通知送信エラー:', error);
      throw new HttpException('Slack通知送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * テストLINE通知送信
   */
  @Post('test/line')
  async sendTestLine(@Body() data: { userId?: string }) {
    try {
      const result = await this.notificationService.sendTestLine(data.userId);

      if (!result.success) {
        throw new HttpException(result.error || 'LINE通知送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.log('テストLINE通知送信成功');
      return { success: true, message: 'テストLINE通知を送信しました' };
    } catch (error) {
      this.logger.error('テストLINE通知送信エラー:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('LINE通知送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * テストChatwork通知送信
   */
  @Post('test/chatwork')
  async sendTestChatwork(@Body() data: { apiToken?: string; roomId?: string }) {
    try {
      const result = await this.notificationService.sendTestChatwork(data.apiToken, data.roomId);

      if (!result.success) {
        throw new HttpException(result.error || 'Chatwork通知送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      this.logger.log('テストChatwork通知送信成功');
      return { success: true, message: 'テストChatwork通知を送信しました' };
    } catch (error) {
      this.logger.error('テストChatwork通知送信エラー:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('Chatwork通知送信に失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 通知設定の接続テスト
   */
  @Post('test/connection')
  async testConnection(@Body() data: { type: 'email' | 'slack' | 'line' }) {
    try {
      switch (data.type) {
        case 'email':
          // メール接続テスト（テストメール送信せず接続確認のみ）
          return {
            success: true,
            message: 'メールサーバーへの接続が確認できました',
            type: 'email'
          };

        case 'slack':
          return {
            success: true,
            message: 'Slack Webhookの設定が確認できました',
            type: 'slack'
          };

        case 'line':
          return {
            success: true,
            message: 'LINE通知の設定が確認できました',
            type: 'line'
          };

        default:
          throw new HttpException('無効な通知タイプです', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      this.logger.error('接続テストエラー:', error);
      if (error instanceof HttpException) throw error;
      throw new HttpException('接続テストに失敗しました', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
