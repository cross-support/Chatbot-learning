import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProactiveService } from './proactive.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Prisma } from '@prisma/client';

@Controller('api/proactive')
export class ProactiveController {
  constructor(private readonly proactiveService: ProactiveService) {}

  // ルール一覧
  @Get('rules')
  @UseGuards(JwtAuthGuard)
  async getRules(@Query('includeDisabled') includeDisabled?: string) {
    return this.proactiveService.getRules(includeDisabled === 'true');
  }

  // ルール詳細
  @Get('rules/:id')
  @UseGuards(JwtAuthGuard)
  async getRule(@Param('id') id: string) {
    return this.proactiveService.getRule(id);
  }

  // ルール作成
  @Post('rules')
  @UseGuards(JwtAuthGuard)
  async createRule(
    @Body()
    body: {
      name: string;
      description?: string;
      triggerType: string;
      triggerConfig: Prisma.InputJsonValue;
      message: string;
      messageType?: string;
      templateId?: string;
      scenarioNodeId?: number;
      delay?: number;
      priority?: number;
      targetSegmentId?: string;
      isEnabled?: boolean;
      showOnce?: boolean;
      maxShowCount?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.proactiveService.createRule({
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }

  // ルール更新
  @Put('rules/:id')
  @UseGuards(JwtAuthGuard)
  async updateRule(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      description?: string;
      triggerType?: string;
      triggerConfig?: Prisma.InputJsonValue;
      message?: string;
      messageType?: string;
      templateId?: string;
      scenarioNodeId?: number;
      delay?: number;
      priority?: number;
      targetSegmentId?: string;
      isEnabled?: boolean;
      showOnce?: boolean;
      maxShowCount?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.proactiveService.updateRule(id, {
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
    });
  }

  // ルール削除
  @Delete('rules/:id')
  @UseGuards(JwtAuthGuard)
  async deleteRule(@Param('id') id: string) {
    return this.proactiveService.deleteRule(id);
  }

  // ルール有効/無効切り替え
  @Post('rules/:id/toggle')
  @UseGuards(JwtAuthGuard)
  async toggleRule(@Param('id') id: string) {
    return this.proactiveService.toggleRule(id);
  }

  // ルール統計
  @Get('rules/:id/stats')
  @UseGuards(JwtAuthGuard)
  async getRuleStats(@Param('id') id: string) {
    return this.proactiveService.getRuleStats(id);
  }

  // 全体統計
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getOverallStats() {
    return this.proactiveService.getOverallStats();
  }

  // ルール評価（ウィジェット側から呼び出し）
  @Post('evaluate')
  async evaluateRules(
    @Body()
    body: {
      sessionId: string;
      userId?: string;
      pageUrl?: string;
      pageTitle?: string;
      timeOnPage?: number;
      scrollDepth?: number;
      isExitIntent?: boolean;
      customData?: Record<string, unknown>;
    },
  ) {
    const matchedRules = await this.proactiveService.evaluateRules(body);

    // マッチしたルールの情報を返す（最優先のものを1つ）
    if (matchedRules.length > 0) {
      const rule = matchedRules[0];
      return {
        hasMatch: true,
        rule: {
          id: rule.id,
          message: rule.message,
          messageType: rule.messageType,
          delay: rule.delay,
        },
      };
    }

    return { hasMatch: false };
  }

  // ログ記録（ウィジェット側から呼び出し）
  @Post('log')
  async logAction(
    @Body()
    body: {
      ruleId: string;
      sessionId: string;
      action: string;
      userId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.proactiveService.logAction(
      body.ruleId,
      body.sessionId,
      body.action,
      body.userId,
      body.metadata,
    );
  }

  // テンプレート一覧（ルール作成用）
  @Get('templates')
  @UseGuards(JwtAuthGuard)
  async getTemplates() {
    return this.proactiveService.getTemplatesForRule();
  }

  // シナリオノード一覧（ルール作成用）
  @Get('scenario-nodes')
  @UseGuards(JwtAuthGuard)
  async getScenarioNodes() {
    return this.proactiveService.getScenarioNodesForRule();
  }
}
