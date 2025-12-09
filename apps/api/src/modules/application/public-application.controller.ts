import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApplicationService } from './application.service';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('public')
@Controller('api/public/app')
export class PublicApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':siteId/config')
  @ApiOperation({ summary: 'siteIdからアプリケーション設定を取得（公開API）' })
  async getConfig(@Param('siteId') siteId: string) {
    try {
      const app = await this.applicationService.findBySiteId(siteId);

      // ウィジェット設定を取得
      const widgetConfig = await this.prisma.chatSettings.findFirst({
        where: {
          applicationId: app.id,
          key: 'widget_config',
        },
      });

      // 設定をマージして返す
      const settings = (app.settings as Record<string, unknown>) || {};
      const widgetSettings = widgetConfig?.value as Record<string, unknown> || {};

      return {
        applicationId: app.id,
        name: app.name,
        ...settings,
        ...widgetSettings,
      };
    } catch {
      throw new NotFoundException('Application not found');
    }
  }

  @Get(':siteId/business-hours')
  @ApiOperation({ summary: 'siteIdから営業時間設定を取得（公開API）' })
  async getBusinessHours(@Param('siteId') siteId: string) {
    try {
      const app = await this.applicationService.findBySiteId(siteId);

      const businessHours = await this.prisma.chatSettings.findFirst({
        where: {
          applicationId: app.id,
          key: 'business_hours',
        },
      });

      if (!businessHours) {
        // デフォルト: 常にオープン
        return { isOpen: true };
      }

      const settings = businessHours.value as {
        enabled?: boolean;
        timezone?: string;
        schedule?: Record<string, { start: string; end: string; enabled: boolean }>;
      };

      if (!settings.enabled) {
        return { isOpen: true };
      }

      // 営業時間判定ロジック
      const now = new Date();
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][now.getDay()];
      const todaySchedule = settings.schedule?.[dayOfWeek];

      if (!todaySchedule?.enabled) {
        return { isOpen: false, reason: 'closed_day' };
      }

      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      const isOpen = currentTime >= todaySchedule.start && currentTime <= todaySchedule.end;

      return {
        isOpen,
        reason: isOpen ? null : 'outside_hours',
        schedule: todaySchedule,
      };
    } catch {
      // アプリが見つからない場合はデフォルトでオープン
      return { isOpen: true };
    }
  }
}
