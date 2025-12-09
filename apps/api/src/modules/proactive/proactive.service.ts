import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface CreateProactiveRuleDto {
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
  startDate?: Date;
  endDate?: Date;
}

interface UpdateProactiveRuleDto {
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
  startDate?: Date;
  endDate?: Date;
}

interface EvaluateContext {
  sessionId: string;
  userId?: string;
  pageUrl?: string;
  pageTitle?: string;
  timeOnPage?: number;
  scrollDepth?: number;
  isExitIntent?: boolean;
  customData?: Record<string, unknown>;
}

@Injectable()
export class ProactiveService {
  constructor(private readonly prisma: PrismaService) {}

  // ルール一覧取得
  async getRules(includeDisabled = false) {
    const where = includeDisabled ? {} : { isEnabled: true };
    return this.prisma.proactiveRule.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ルール詳細取得
  async getRule(id: string) {
    const rule = await this.prisma.proactiveRule.findUnique({
      where: { id },
      include: {
        logs: {
          take: 100,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!rule) {
      throw new NotFoundException('Proactive rule not found');
    }

    return rule;
  }

  // ルール作成
  async createRule(dto: CreateProactiveRuleDto) {
    return this.prisma.proactiveRule.create({
      data: {
        name: dto.name,
        description: dto.description,
        triggerType: dto.triggerType,
        triggerConfig: dto.triggerConfig,
        message: dto.message,
        messageType: dto.messageType || 'text',
        templateId: dto.templateId,
        scenarioNodeId: dto.scenarioNodeId,
        delay: dto.delay || 0,
        priority: dto.priority || 0,
        targetSegmentId: dto.targetSegmentId,
        isEnabled: dto.isEnabled ?? true,
        showOnce: dto.showOnce ?? true,
        maxShowCount: dto.maxShowCount || 1,
        startDate: dto.startDate,
        endDate: dto.endDate,
      },
    });
  }

  // ルール更新
  async updateRule(id: string, dto: UpdateProactiveRuleDto) {
    const rule = await this.prisma.proactiveRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Proactive rule not found');
    }

    return this.prisma.proactiveRule.update({
      where: { id },
      data: dto,
    });
  }

  // ルール削除
  async deleteRule(id: string) {
    const rule = await this.prisma.proactiveRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Proactive rule not found');
    }

    return this.prisma.proactiveRule.delete({
      where: { id },
    });
  }

  // ルールの有効/無効切り替え
  async toggleRule(id: string) {
    const rule = await this.prisma.proactiveRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException('Proactive rule not found');
    }

    return this.prisma.proactiveRule.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });
  }

  // コンテキストに基づいてマッチするルールを評価
  async evaluateRules(context: EvaluateContext) {
    const now = new Date();

    // 有効なルールを取得
    const rules = await this.prisma.proactiveRule.findMany({
      where: {
        isEnabled: true,
        OR: [{ startDate: null }, { startDate: { lte: now } }],
        AND: [{ OR: [{ endDate: null }, { endDate: { gte: now } }] }],
      },
      orderBy: { priority: 'desc' },
    });

    const matchedRules: typeof rules = [];

    for (const rule of rules) {
      // セッションで既に表示済みかチェック
      if (rule.showOnce || rule.maxShowCount > 0) {
        const showCount = await this.prisma.proactiveLog.count({
          where: {
            ruleId: rule.id,
            sessionId: context.sessionId,
            action: 'shown',
          },
        });

        if (showCount >= rule.maxShowCount) {
          continue;
        }
      }

      // トリガー条件を評価
      if (this.evaluateTrigger(rule, context)) {
        matchedRules.push(rule);
      }
    }

    return matchedRules;
  }

  // 個別のトリガー評価
  private evaluateTrigger(
    rule: { triggerType: string; triggerConfig: unknown },
    context: EvaluateContext,
  ): boolean {
    const config = rule.triggerConfig as Record<string, unknown>;

    switch (rule.triggerType) {
      case 'page_view':
        // URL/パスパターンにマッチするか
        if (config.urlPattern && context.pageUrl) {
          const pattern = new RegExp(config.urlPattern as string, 'i');
          return pattern.test(context.pageUrl);
        }
        return true;

      case 'time_on_page':
        // ページ滞在時間
        if (config.seconds && context.timeOnPage) {
          return context.timeOnPage >= (config.seconds as number);
        }
        return false;

      case 'scroll_depth':
        // スクロール深度
        if (config.percentage && context.scrollDepth) {
          return context.scrollDepth >= (config.percentage as number);
        }
        return false;

      case 'exit_intent':
        // 離脱意図
        return context.isExitIntent === true;

      case 'custom':
        // カスタムイベント
        if (config.eventName && context.customData) {
          return context.customData[config.eventName as string] !== undefined;
        }
        return false;

      default:
        return false;
    }
  }

  // ログ記録
  async logAction(
    ruleId: string,
    sessionId: string,
    action: string,
    userId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.prisma.proactiveLog.create({
      data: {
        ruleId,
        sessionId,
        userId,
        action,
        metadata: metadata ?? Prisma.JsonNull,
      },
    });
  }

  // ルールの統計情報
  async getRuleStats(ruleId: string) {
    const [shown, clicked, dismissed, converted] = await Promise.all([
      this.prisma.proactiveLog.count({
        where: { ruleId, action: 'shown' },
      }),
      this.prisma.proactiveLog.count({
        where: { ruleId, action: 'clicked' },
      }),
      this.prisma.proactiveLog.count({
        where: { ruleId, action: 'dismissed' },
      }),
      this.prisma.proactiveLog.count({
        where: { ruleId, action: 'converted' },
      }),
    ]);

    return {
      shown,
      clicked,
      dismissed,
      converted,
      clickRate: shown > 0 ? Math.round((clicked / shown) * 100) : 0,
      conversionRate: shown > 0 ? Math.round((converted / shown) * 100) : 0,
    };
  }

  // 全ルールの統計サマリー
  async getOverallStats() {
    const [totalRules, activeRules, totalShown, totalClicked, totalConverted] =
      await Promise.all([
        this.prisma.proactiveRule.count(),
        this.prisma.proactiveRule.count({ where: { isEnabled: true } }),
        this.prisma.proactiveLog.count({ where: { action: 'shown' } }),
        this.prisma.proactiveLog.count({ where: { action: 'clicked' } }),
        this.prisma.proactiveLog.count({ where: { action: 'converted' } }),
      ]);

    // 日別トレンド（過去7日）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await this.prisma.proactiveLog.groupBy({
      by: ['action'],
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      _count: true,
    });

    return {
      totalRules,
      activeRules,
      totalShown,
      totalClicked,
      totalConverted,
      overallClickRate:
        totalShown > 0 ? Math.round((totalClicked / totalShown) * 100) : 0,
      overallConversionRate:
        totalShown > 0 ? Math.round((totalConverted / totalShown) * 100) : 0,
      dailyStats,
    };
  }

  // テンプレート一覧（ルール作成時に選択用）
  async getTemplatesForRule() {
    return this.prisma.template.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        content: true,
        category: true,
      },
      orderBy: { order: 'asc' },
    });
  }

  // シナリオノード一覧（ルール作成時に選択用）
  async getScenarioNodesForRule() {
    return this.prisma.scenarioNode.findMany({
      where: { isActive: true, level: 0 },
      select: {
        id: true,
        nodeName: true,
        triggerText: true,
        responseText: true,
      },
      orderBy: { order: 'asc' },
    });
  }
}
