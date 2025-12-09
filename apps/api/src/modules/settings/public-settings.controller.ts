import {
  Controller,
  Get,
  Post,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';

interface OffHoursInquiryDto {
  name: string;
  email: string;
  company: string;
  content: string;
}

interface WidgetConfig {
  botIconUrl?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  headerColor?: string;
  headerTextColor?: string;
  primaryColor?: string;
}

@ApiTags('public-settings')
@Controller('api/public/settings')
export class PublicSettingsController {
  constructor(
    private settingsService: SettingsService,
    private notificationService: NotificationService,
    private prisma: PrismaService,
  ) {}

  @Get('business-hours')
  @ApiOperation({ summary: '営業時間内かどうかをチェック（認証不要）' })
  async checkBusinessHours() {
    const isOpen = await this.settingsService.isBusinessHoursFromChatSettings();
    return { isOpen };
  }

  @Post('off-hours-inquiry')
  @ApiOperation({ summary: '時間外問い合わせ送信（認証不要）' })
  async submitOffHoursInquiry(@Body() dto: OffHoursInquiryDto) {
    try {
      // DBに保存
      const inquiry = await this.prisma.offHoursInquiry.create({
        data: {
          name: dto.name,
          email: dto.email,
          company: dto.company || null,
          content: dto.content,
          status: 'PENDING',
        },
      });

      // メール通知を送信
      try {
        await this.notificationService.sendOffHoursInquiryEmail(dto);
      } catch (emailError) {
        console.error('Email notification failed:', emailError);
        // メール送信失敗してもDBには保存されているのでOK
      }

      return {
        success: true,
        message: '問い合わせを受け付けました',
        inquiryId: inquiry.id,
      };
    } catch (error) {
      console.error('Off-hours inquiry error:', error);
      return { success: false, message: '問い合わせの送信に失敗しました' };
    }
  }

  @Get('widget-config')
  @ApiOperation({ summary: 'ウィジェット設定を取得（認証不要）' })
  async getWidgetConfig(): Promise<WidgetConfig> {
    // widget_config設定を取得
    const widgetConfig = await this.settingsService.get('widget_config') as {
      botIconUrl?: string;
      headerTitle?: string;
      headerSubtitle?: string;
      headerColor?: string;
      headerTextColor?: string;
      primaryColor?: string;
    } | null;

    // デフォルト値とマージして返す
    return {
      botIconUrl: widgetConfig?.botIconUrl || '',
      headerTitle: widgetConfig?.headerTitle || 'クロスラーニング サポート',
      headerSubtitle: widgetConfig?.headerSubtitle || '',
      headerColor: widgetConfig?.headerColor || '#F5A623',
      headerTextColor: widgetConfig?.headerTextColor || '#FFFFFF',
      primaryColor: widgetConfig?.primaryColor || '#F5A623',
    };
  }
}
