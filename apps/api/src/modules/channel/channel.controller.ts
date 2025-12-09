import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Headers,
  UseGuards,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ChannelService } from './channel.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('channels')
export class ChannelController {
  constructor(private readonly channelService: ChannelService) {}

  // ===== チャネル設定管理 =====

  @Post('config/:channelType')
  @UseGuards(JwtAuthGuard)
  async upsertConfig(
    @Param('channelType') channelType: 'line' | 'slack' | 'teams' | 'facebook',
    @Body()
    body: {
      credentials: Record<string, string>;
      config?: Record<string, unknown>;
    },
  ) {
    return this.channelService.upsertChannelConfig(
      channelType,
      body.credentials as unknown as Parameters<typeof this.channelService.upsertChannelConfig>[1],
      body.config,
    );
  }

  @Get('config')
  @UseGuards(JwtAuthGuard)
  async getAllConfigs() {
    return this.channelService.getAllChannelConfigs();
  }

  @Get('config/:channelType')
  @UseGuards(JwtAuthGuard)
  async getConfig(@Param('channelType') channelType: string) {
    return this.channelService.getChannelConfig(channelType);
  }

  @Put('config/:channelType/enable')
  @UseGuards(JwtAuthGuard)
  async setEnabled(
    @Param('channelType') channelType: string,
    @Body() body: { isEnabled: boolean },
  ) {
    return this.channelService.setChannelEnabled(channelType, body.isEnabled);
  }

  // ===== LINE Webhook =====

  @Post('webhook/line')
  async lineWebhook(
    @Headers('x-line-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const body = req.rawBody?.toString() || '';

    const isValid = await this.channelService.verifyLineSignature(body, signature);
    if (!isValid) {
      return { error: 'Invalid signature' };
    }

    const events = JSON.parse(body).events || [];
    for (const event of events) {
      await this.handleLineEvent(event);
    }

    return { success: true };
  }

  // ===== Slack Webhook =====

  @Post('webhook/slack')
  async slackWebhook(
    @Headers('x-slack-signature') signature: string,
    @Headers('x-slack-request-timestamp') timestamp: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const body = req.rawBody?.toString() || '';

    // URL検証チャレンジ
    const payload = JSON.parse(body);
    if (payload.type === 'url_verification') {
      return { challenge: payload.challenge };
    }

    const isValid = await this.channelService.verifySlackSignature(body, timestamp, signature);
    if (!isValid) {
      return { error: 'Invalid signature' };
    }

    if (payload.event) {
      await this.handleSlackEvent(payload.event);
    }

    return { success: true };
  }

  // ===== メッセージ送信 =====

  @Post('line/send')
  @UseGuards(JwtAuthGuard)
  async sendLineMessage(
    @Body() body: { to: string; messages: Array<{ type: string; text?: string }> },
  ) {
    return this.channelService.sendLineMessage(body.to, body.messages);
  }

  @Post('slack/send')
  @UseGuards(JwtAuthGuard)
  async sendSlackMessage(
    @Body() body: { channel: string; text: string; blocks?: unknown[] },
  ) {
    return this.channelService.sendSlackMessage(body.channel, body.text, body.blocks);
  }

  // ===== 統計 =====

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats() {
    return this.channelService.getChannelStats();
  }

  // ===== プライベートメソッド =====

  private async handleLineEvent(event: Record<string, unknown>) {
    if (event.type === 'message') {
      const source = event.source as { type: string; userId?: string };
      if (source.userId) {
        await this.channelService.upsertChannelUser({
          channelType: 'line',
          channelUserId: source.userId,
        });
      }
      // メッセージ処理をChatServiceに委譲（実装時）
    } else if (event.type === 'follow') {
      const source = event.source as { userId?: string };
      if (source.userId) {
        await this.channelService.upsertChannelUser({
          channelType: 'line',
          channelUserId: source.userId,
        });
      }
    }
  }

  private async handleSlackEvent(event: Record<string, unknown>) {
    if (event.type === 'message' && !event.bot_id) {
      const userId = event.user as string;
      if (userId) {
        await this.channelService.upsertChannelUser({
          channelType: 'slack',
          channelUserId: userId,
        });
      }
      // メッセージ処理をChatServiceに委譲（実装時）
    }
  }
}
