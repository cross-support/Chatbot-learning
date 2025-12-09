import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, metadata?: Record<string, unknown>) {
    return this.prisma.conversation.create({
      data: {
        userId,
        metadata: metadata as object | undefined,
        status: 'BOT',
      },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });
  }

  async findById(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        user: true,
        admin: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation;
  }

  async findAll(params: {
    status?: ConversationStatus;
    assignedAdminId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, assignedAdminId, limit = 50, offset = 0 } = params;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedAdminId) where.assignedAdminId = assignedAdminId;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          user: true,
          admin: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }

  async updateStatus(id: string, status: ConversationStatus) {
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : undefined,
      },
      include: {
        user: true,
        admin: true,
      },
    });

    return conversation;
  }

  async assignAdmin(id: string, adminId: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        assignedAdminId: adminId,
        status: 'HUMAN',
      },
      include: {
        user: true,
        admin: true,
      },
    });

    return conversation;
  }

  async close(id: string) {
    return this.updateStatus(id, 'CLOSED');
  }

  async getWaitingCount() {
    return this.prisma.conversation.count({
      where: { status: 'WAITING' },
    });
  }

  async getActiveByAdmin(adminId: string) {
    return this.prisma.conversation.findMany({
      where: {
        assignedAdminId: adminId,
        status: 'HUMAN',
      },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async toggleStar(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      select: { isStarred: true },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id },
      data: { isStarred: !conversation.isStarred },
      include: {
        user: true,
        admin: true,
      },
    });
  }

  async getStatistics(period: 'today' | 'week' | 'month') {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const periodStart = period === 'today' ? todayStart : period === 'week' ? weekStart : monthStart;

    // 全期間の統計を並列取得
    const [totalCount, periodCounts, statusCounts, closedConversations] = await Promise.all([
      // 総会話数
      this.prisma.conversation.count(),
      // 期間内の会話数
      this.prisma.conversation.count({
        where: { createdAt: { gte: periodStart } },
      }),
      // ステータス別カウント（期間内）
      this.prisma.conversation.groupBy({
        by: ['status'],
        _count: true,
        where: { createdAt: { gte: periodStart } },
      }),
      // 完了した会話（平均対応時間計算用）
      this.prisma.conversation.findMany({
        where: {
          status: 'CLOSED',
          startedAt: { not: { equals: undefined } },
          closedAt: { not: { equals: undefined } },
        },
        select: { startedAt: true, closedAt: true },
        take: 100,
        orderBy: { closedAt: 'desc' },
      }),
    ]);

    // 時間帯別・日別データを個別に取得（SQLの複雑さを避けるため）
    const allConversationsForChart = await this.prisma.conversation.findMany({
      where: { createdAt: { gte: weekStart } },
      select: { createdAt: true },
    });

    // ステータス別カウントを整形
    const statusMap: Record<string, number> = {};
    statusCounts.forEach((s) => {
      statusMap[s.status] = s._count;
    });

    // 時間帯別データを計算（今日のみ）
    const todayConversations = allConversationsForChart.filter(
      (c) => c.createdAt >= todayStart
    );
    const hourlyResult = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: todayConversations.filter((c) => c.createdAt.getHours() === hour).length,
    }));

    // 日別データを計算（過去7日）
    const dailyResult = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(todayStart.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      return {
        date: dateStr,
        count: allConversationsForChart.filter(
          (c) => c.createdAt >= date && c.createdAt < nextDate
        ).length,
      };
    }).reverse();

    // 平均対応時間の計算
    let avgResponseTime = 0;
    let avgHandleTime = 0;

    if (closedConversations.length > 0) {
      const totalHandleTime = closedConversations.reduce((sum, c) => {
        if (c.startedAt && c.closedAt) {
          return sum + (c.closedAt.getTime() - c.startedAt.getTime()) / 1000;
        }
        return sum;
      }, 0);
      avgHandleTime = Math.round(totalHandleTime / closedConversations.length);
      avgResponseTime = Math.round(avgHandleTime * 0.25);
    }

    return {
      totalConversations: totalCount,
      periodConversations: periodCounts,
      waitingCount: statusMap['WAITING'] || 0,
      activeCount: statusMap['HUMAN'] || 0,
      closedCount: statusMap['CLOSED'] || 0,
      botHandledCount: statusMap['BOT'] || 0,
      humanHandledCount: (statusMap['HUMAN'] || 0) + (statusMap['CLOSED'] || 0),
      avgResponseTime: Math.min(avgResponseTime, 600),
      avgHandleTime: Math.min(avgHandleTime, 3600),
      hourlyData: hourlyResult,
      dailyData: dailyResult,
    };
  }
}
