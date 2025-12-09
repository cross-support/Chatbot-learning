import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type WidgetType =
  | 'chart'
  | 'counter'
  | 'list'
  | 'gauge';

export interface WidgetConfig {
  chartType?: 'line' | 'bar' | 'pie' | 'number' | 'table';
  dateRange?: 'today' | 'week' | 'month' | 'custom';
  filters?: Record<string, unknown>;
}

export interface CreateWidgetData {
  name: string;
  type: WidgetType;
  dataSource: string;
  config?: WidgetConfig;
  query?: Record<string, unknown>;
  refreshInterval?: number;
  isDefault?: boolean;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== ウィジェット管理 =====

  async createWidget(data: CreateWidgetData) {
    return this.prisma.dashboardWidget.create({
      data: {
        name: data.name,
        type: data.type,
        dataSource: data.dataSource,
        config: (data.config || {}) as Prisma.InputJsonValue,
        query: data.query as Prisma.InputJsonValue,
        refreshInterval: data.refreshInterval ?? 60,
        isDefault: data.isDefault ?? false,
      },
    });
  }

  async getWidgets(defaultOnly = false) {
    return this.prisma.dashboardWidget.findMany({
      where: defaultOnly ? { isDefault: true } : undefined,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getWidget(id: string) {
    const widget = await this.prisma.dashboardWidget.findUnique({
      where: { id },
    });
    if (!widget) {
      throw new NotFoundException('Widget not found');
    }
    return widget;
  }

  async updateWidget(id: string, data: Partial<CreateWidgetData>) {
    const updateData: Prisma.DashboardWidgetUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.dataSource !== undefined) updateData.dataSource = data.dataSource;
    if (data.config !== undefined) updateData.config = data.config as Prisma.InputJsonValue;
    if (data.query !== undefined) updateData.query = data.query as Prisma.InputJsonValue;
    if (data.refreshInterval !== undefined) updateData.refreshInterval = data.refreshInterval;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    return this.prisma.dashboardWidget.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteWidget(id: string) {
    return this.prisma.dashboardWidget.delete({ where: { id } });
  }

  // ===== ウィジェットデータ取得 =====

  async getWidgetData(id: string) {
    const widget = await this.getWidget(id);

    switch (widget.dataSource) {
      case 'conversations':
        return this.getConversationData(widget.config as WidgetConfig);
      case 'messages':
        return this.getMessageData(widget.config as WidgetConfig);
      case 'surveys':
        return this.getSurveyData(widget.config as WidgetConfig);
      case 'sla':
        return this.getSlaData();
      case 'operators':
        return this.getOperatorData(widget.config as WidgetConfig);
      default:
        return { message: 'Unknown data source' };
    }
  }

  // ===== データプロバイダー =====

  private async getConversationData(config: WidgetConfig) {
    const dateRange = this.getDateRange(config?.dateRange);

    const [active, waiting, closed, total] = await Promise.all([
      this.prisma.conversation.count({ where: { status: 'HUMAN', createdAt: dateRange } }),
      this.prisma.conversation.count({ where: { status: 'WAITING', createdAt: dateRange } }),
      this.prisma.conversation.count({ where: { status: 'CLOSED', createdAt: dateRange } }),
      this.prisma.conversation.count({ where: { createdAt: dateRange } }),
    ]);

    return {
      active,
      waiting,
      closed,
      total,
    };
  }

  private async getMessageData(config: WidgetConfig) {
    const dateRange = this.getDateRange(config?.dateRange);

    const messages = await this.prisma.message.groupBy({
      by: ['senderType'],
      where: { createdAt: dateRange },
      _count: true,
    });

    return messages.map((m) => ({
      senderType: m.senderType,
      count: m._count,
    }));
  }

  private async getSurveyData(config: WidgetConfig) {
    const dateRange = this.getDateRange(config?.dateRange);

    const ratings = await this.prisma.satisfactionSurvey.findMany({
      where: { createdAt: dateRange },
      select: { rating: true },
    });

    const average =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : null;

    const distribution = [1, 2, 3, 4, 5].map((score) => ({
      score,
      count: ratings.filter((r) => r.rating === score).length,
    }));

    return {
      average,
      total: ratings.length,
      distribution,
    };
  }

  private async getSlaData() {
    const [breached, onTrack, total] = await Promise.all([
      this.prisma.slaTracking.count({ where: { isBreached: true, resolvedAt: null } }),
      this.prisma.slaTracking.count({ where: { isBreached: false, resolvedAt: null } }),
      this.prisma.slaTracking.count({ where: { resolvedAt: null } }),
    ]);

    return { breached, onTrack, total };
  }

  private async getOperatorData(config: WidgetConfig) {
    const dateRange = this.getDateRange(config?.dateRange);

    const operators = await this.prisma.admin.findMany({
      where: { role: { in: ['OPERATOR', 'ADMIN'] } },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: {
            conversations: {
              where: { createdAt: dateRange },
            },
          },
        },
      },
    });

    return operators.map((op) => ({
      id: op.id,
      name: op.name || op.email,
      conversationCount: op._count.conversations,
    }));
  }

  // ===== ヘルパー =====

  private getDateRange(range?: string): Prisma.DateTimeFilter | undefined {
    const now = new Date();
    switch (range) {
      case 'today':
        return { gte: new Date(now.setHours(0, 0, 0, 0)) };
      case 'week':
        return { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      case 'month':
        return { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      default:
        return undefined;
    }
  }

  // デフォルトウィジェットを作成
  async createDefaultWidgets() {
    const defaultWidgets: CreateWidgetData[] = [
      { name: 'アクティブな会話', type: 'counter', dataSource: 'conversations', isDefault: true },
      { name: 'SLAステータス', type: 'gauge', dataSource: 'sla', isDefault: true },
      { name: '顧客満足度', type: 'chart', dataSource: 'surveys', isDefault: true },
      { name: 'オペレーター実績', type: 'list', dataSource: 'operators', isDefault: true },
    ];

    const widgets = await Promise.all(
      defaultWidgets.map((w) => this.createWidget(w))
    );

    return widgets;
  }
}
