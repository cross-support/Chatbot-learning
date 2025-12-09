import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('webhooks')
@Controller('api/settings/webhooks')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WebhookController {
  constructor(private webhookService: WebhookService) {}

  @Get()
  @ApiOperation({ summary: 'Webhook一覧取得' })
  async findAll() {
    return this.webhookService.findAll();
  }

  @Get('events')
  @ApiOperation({ summary: '利用可能なイベント一覧' })
  getAvailableEvents() {
    return this.webhookService.getAvailableEvents();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Webhook詳細取得' })
  async findById(@Param('id') id: string) {
    return this.webhookService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Webhook作成' })
  async create(
    @Body() body: {
      name: string;
      url: string;
      events: string[];
    },
  ) {
    return this.webhookService.create(body.name, body.url, body.events);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Webhook更新' })
  async update(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      url?: string;
      events?: string[];
      isActive?: boolean;
    },
  ) {
    return this.webhookService.update(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Webhook削除' })
  async delete(@Param('id') id: string) {
    return this.webhookService.delete(id);
  }

  @Post(':id/regenerate-secret')
  @ApiOperation({ summary: 'Webhookシークレット再生成' })
  async regenerateSecret(@Param('id') id: string) {
    return this.webhookService.regenerateSecret(id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Webhookテスト' })
  async test(@Param('id') id: string) {
    return this.webhookService.testWebhook(id);
  }

  // ==================== イベントログ関連 ====================

  @Get('logs/all')
  @ApiOperation({ summary: 'Webhookイベントログ一覧' })
  async getEventLogs(
    @Query('webhookId') webhookId?: string,
    @Query('status') status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXHAUSTED',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.webhookService.getEventLogs({
      webhookId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id/logs')
  @ApiOperation({ summary: '特定Webhookのイベントログ' })
  async getWebhookLogs(
    @Param('id') webhookId: string,
    @Query('status') status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXHAUSTED',
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.webhookService.getEventLogs({
      webhookId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post('logs/:logId/retry')
  @ApiOperation({ summary: 'イベントを手動リトライ' })
  async retryEvent(@Param('logId') logId: string) {
    return this.webhookService.retryEvent(logId);
  }

  @Delete('logs/cleanup')
  @ApiOperation({ summary: '古いログを削除' })
  async cleanupLogs(@Query('days') days?: string) {
    const daysToKeep = days ? parseInt(days, 10) : 30;
    return this.webhookService.cleanupOldLogs(daysToKeep);
  }
}
