import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: { status: string; latency?: number; error?: string };
    memory: { status: string; used: number; total: number; percentage: number };
    activeConnections?: number;
  };
}

export interface SystemMetrics {
  conversations: {
    total: number;
    active: number;
    waiting: number;
    closedToday: number;
  };
  messages: {
    totalToday: number;
    byType: Record<string, number>;
  };
  users: {
    total: number;
    activeToday: number;
  };
  operators: {
    online: number;
    busy: number;
    away: number;
    offline: number;
  };
  webhooks: {
    pending: number;
    failed: number;
    successRate: number;
  };
  inquiries: {
    pending: number;
    inProgress: number;
  };
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private readonly startTime = Date.now();

  constructor(private prisma: PrismaService) {}

  /**
   * システムヘルスチェック
   */
  async getHealth(): Promise<HealthStatus> {
    const checks = {
      database: await this.checkDatabase(),
      memory: this.checkMemory(),
    };

    // 全体ステータス判定
    const hasError = Object.values(checks).some(c => c.status === 'error');
    const hasWarning = Object.values(checks).some(c => c.status === 'warning');

    return {
      status: hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      checks,
    };
  }

  /**
   * データベース接続チェック
   */
  private async checkDatabase(): Promise<{ status: string; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      return {
        status: latency > 1000 ? 'warning' : 'ok',
        latency,
      };
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return {
        status: 'error',
        error: 'Database connection failed',
      };
    }
  }

  /**
   * メモリ使用量チェック
   */
  private checkMemory(): { status: string; used: number; total: number; percentage: number } {
    const memUsage = process.memoryUsage();
    const used = Math.round(memUsage.heapUsed / 1024 / 1024);
    const total = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percentage = Math.round((used / total) * 100);

    return {
      status: percentage > 90 ? 'warning' : 'ok',
      used,
      total,
      percentage,
    };
  }

  /**
   * システムメトリクス取得
   */
  async getMetrics(): Promise<SystemMetrics> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      conversationStats,
      messageStats,
      userStats,
      operatorStats,
      webhookStats,
      inquiryStats,
    ] = await Promise.all([
      this.getConversationStats(today),
      this.getMessageStats(today),
      this.getUserStats(today),
      this.getOperatorStats(),
      this.getWebhookStats(),
      this.getInquiryStats(),
    ]);

    return {
      conversations: conversationStats,
      messages: messageStats,
      users: userStats,
      operators: operatorStats,
      webhooks: webhookStats,
      inquiries: inquiryStats,
    };
  }

  private async getConversationStats(today: Date) {
    const [total, active, waiting, closedToday] = await Promise.all([
      this.prisma.conversation.count(),
      this.prisma.conversation.count({
        where: { status: { in: ['BOT', 'HUMAN'] } },
      }),
      this.prisma.conversation.count({
        where: { status: 'WAITING' },
      }),
      this.prisma.conversation.count({
        where: {
          status: 'CLOSED',
          closedAt: { gte: today },
        },
      }),
    ]);

    return { total, active, waiting, closedToday };
  }

  private async getMessageStats(today: Date) {
    const [totalToday, messagesByType] = await Promise.all([
      this.prisma.message.count({
        where: { createdAt: { gte: today } },
      }),
      this.prisma.message.groupBy({
        by: ['senderType'],
        where: { createdAt: { gte: today } },
        _count: true,
      }),
    ]);

    const byType: Record<string, number> = {};
    messagesByType.forEach(m => {
      byType[m.senderType] = m._count;
    });

    return { totalToday, byType };
  }

  private async getUserStats(today: Date) {
    const [total, activeToday] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: { updatedAt: { gte: today } },
      }),
    ]);

    return { total, activeToday };
  }

  private async getOperatorStats() {
    const stats = await this.prisma.admin.groupBy({
      by: ['status'],
      _count: true,
    });

    const result = { online: 0, busy: 0, away: 0, offline: 0 };
    stats.forEach(s => {
      const key = s.status.toLowerCase() as keyof typeof result;
      if (key in result) {
        result[key] = s._count;
      }
    });

    return result;
  }

  private async getWebhookStats() {
    const [pending, failed, successCount, totalCount] = await Promise.all([
      this.prisma.webhookEventLog.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.webhookEventLog.count({
        where: { status: { in: ['FAILED', 'EXHAUSTED'] } },
      }),
      this.prisma.webhookEventLog.count({
        where: { status: 'SUCCESS' },
      }),
      this.prisma.webhookEventLog.count(),
    ]);

    return {
      pending,
      failed,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
    };
  }

  private async getInquiryStats() {
    const [pending, inProgress] = await Promise.all([
      this.prisma.offHoursInquiry.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.offHoursInquiry.count({
        where: { status: 'IN_PROGRESS' },
      }),
    ]);

    return { pending, inProgress };
  }

  /**
   * アクティビティログ取得（直近のシステムイベント）
   */
  async getRecentActivity(limit = 50) {
    const [securityLogs, recentConversations, webhookEvents] = await Promise.all([
      this.prisma.securityLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.conversation.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          admin: { select: { name: true } },
        },
      }),
      this.prisma.webhookEventLog.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        where: { status: { in: ['FAILED', 'EXHAUSTED'] } },
      }),
    ]);

    return {
      securityLogs,
      recentConversations,
      failedWebhooks: webhookEvents,
    };
  }

  /**
   * 日次統計レポート生成
   */
  async getDailyReport(date?: Date) {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      conversationsCreated,
      conversationsClosed,
      messagesCount,
      newUsers,
      inquiriesReceived,
      inquiriesResolved,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.conversation.count({
        where: {
          closedAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.message.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.offHoursInquiry.count({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      this.prisma.offHoursInquiry.count({
        where: {
          resolvedAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    // 時間帯別メッセージ数
    const hourlyMessages = await this.prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*) as count
      FROM "Message"
      WHERE "createdAt" >= ${startOfDay} AND "createdAt" <= ${endOfDay}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    return {
      date: startOfDay.toISOString().split('T')[0],
      conversations: {
        created: conversationsCreated,
        closed: conversationsClosed,
      },
      messages: messagesCount,
      newUsers,
      inquiries: {
        received: inquiriesReceived,
        resolved: inquiriesResolved,
      },
      hourlyMessages: hourlyMessages.map(h => ({
        hour: Number(h.hour),
        count: Number(h.count),
      })),
    };
  }
}
