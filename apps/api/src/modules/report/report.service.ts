import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 期間別サマリーレポート
   */
  async getPeriodSummary(startDate: Date, endDate: Date) {
    const [
      conversations,
      messages,
      inquiries,
      surveys,
      users,
    ] = await Promise.all([
      this.getConversationStats(startDate, endDate),
      this.getMessageStats(startDate, endDate),
      this.getInquiryStats(startDate, endDate),
      this.getSurveyStats(startDate, endDate),
      this.getUserStats(startDate, endDate),
    ]);

    return {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      conversations,
      messages,
      inquiries,
      surveys,
      users,
    };
  }

  /**
   * 会話統計
   */
  private async getConversationStats(startDate: Date, endDate: Date) {
    const where = { createdAt: { gte: startDate, lte: endDate } };

    const [total, byStatus, avgDuration] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.conversation.findMany({
        where: { ...where, closedAt: { not: null } },
        select: { createdAt: true, closedAt: true },
      }),
    ]);

    // 平均対応時間を計算
    const durations = avgDuration
      .filter((c) => c.closedAt)
      .map((c) => c.closedAt!.getTime() - c.createdAt.getTime());
    const avgDurationMs =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {},
      ),
      averageDurationMinutes: Math.round(avgDurationMs / 60000),
    };
  }

  /**
   * メッセージ統計
   */
  private async getMessageStats(startDate: Date, endDate: Date) {
    const where = { createdAt: { gte: startDate, lte: endDate } };

    const [total, bySenderType, byContentType] = await Promise.all([
      this.prisma.message.count({ where }),
      this.prisma.message.groupBy({
        by: ['senderType'],
        where,
        _count: true,
      }),
      this.prisma.message.groupBy({
        by: ['contentType'],
        where,
        _count: true,
      }),
    ]);

    return {
      total,
      bySenderType: bySenderType.reduce(
        (acc, s) => ({ ...acc, [s.senderType]: s._count }),
        {},
      ),
      byContentType: byContentType.reduce(
        (acc, s) => ({ ...acc, [s.contentType]: s._count }),
        {},
      ),
    };
  }

  /**
   * 問い合わせ統計
   */
  private async getInquiryStats(startDate: Date, endDate: Date) {
    const where = { createdAt: { gte: startDate, lte: endDate } };

    const [total, byStatus, resolved] = await Promise.all([
      this.prisma.offHoursInquiry.count({ where }),
      this.prisma.offHoursInquiry.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      this.prisma.offHoursInquiry.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
    ]);

    // 平均解決時間を計算
    const resolutionTimes = resolved
      .filter((i) => i.resolvedAt)
      .map((i) => i.resolvedAt!.getTime() - i.createdAt.getTime());
    const avgResolutionMs =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
        : 0;

    return {
      total,
      byStatus: byStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {},
      ),
      averageResolutionHours: Math.round(avgResolutionMs / 3600000 * 10) / 10,
    };
  }

  /**
   * 満足度統計
   */
  private async getSurveyStats(startDate: Date, endDate: Date) {
    const surveys = await this.prisma.satisfactionSurvey.findMany({
      where: { createdAt: { gte: startDate, lte: endDate } },
    });

    if (surveys.length === 0) {
      return { total: 0, averageRating: 0, npsScore: 0 };
    }

    const avgRating =
      surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length;
    const promoters = surveys.filter((s) => s.rating >= 4).length;
    const detractors = surveys.filter((s) => s.rating <= 2).length;
    const npsScore = Math.round(
      ((promoters - detractors) / surveys.length) * 100,
    );

    return {
      total: surveys.length,
      averageRating: Math.round(avgRating * 10) / 10,
      npsScore,
    };
  }

  /**
   * ユーザー統計
   */
  private async getUserStats(startDate: Date, endDate: Date) {
    const [newUsers, activeUsers] = await Promise.all([
      this.prisma.user.count({
        where: { createdAt: { gte: startDate, lte: endDate } },
      }),
      this.prisma.user.count({
        where: { updatedAt: { gte: startDate, lte: endDate } },
      }),
    ]);

    return { newUsers, activeUsers };
  }

  /**
   * オペレーター別レポート
   */
  async getOperatorReport(startDate: Date, endDate: Date) {
    const admins = await this.prisma.admin.findMany({
      where: { role: { in: ['OPERATOR', 'ADMIN'] } },
    });

    const reports = await Promise.all(
      admins.map(async (admin) => {
        const [conversations, messages] = await Promise.all([
          this.prisma.conversation.count({
            where: {
              assignedAdminId: admin.id,
              createdAt: { gte: startDate, lte: endDate },
            },
          }),
          this.prisma.message.count({
            where: {
              senderType: 'ADMIN',
              conversation: {
                assignedAdminId: admin.id,
                createdAt: { gte: startDate, lte: endDate },
              },
            },
          }),
        ]);

        // 対応した会話の平均時間
        const closedConversations = await this.prisma.conversation.findMany({
          where: {
            assignedAdminId: admin.id,
            closedAt: { not: null },
            createdAt: { gte: startDate, lte: endDate },
          },
          select: { createdAt: true, closedAt: true },
        });

        const durations = closedConversations
          .filter((c) => c.closedAt)
          .map((c) => c.closedAt!.getTime() - c.createdAt.getTime());
        const avgDuration =
          durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;

        return {
          adminId: admin.id,
          adminName: admin.name,
          adminEmail: admin.email,
          conversationsHandled: conversations,
          messagesSent: messages,
          averageHandlingMinutes: Math.round(avgDuration / 60000),
        };
      }),
    );

    return reports.sort((a, b) => b.conversationsHandled - a.conversationsHandled);
  }

  /**
   * 時間帯別レポート
   */
  async getHourlyReport(startDate: Date, endDate: Date) {
    const conversations = await this.prisma.$queryRaw<
      { hour: number; count: bigint }[]
    >`
      SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*) as count
      FROM "Conversation"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    const messages = await this.prisma.$queryRaw<
      { hour: number; count: bigint }[]
    >`
      SELECT EXTRACT(HOUR FROM "createdAt") as hour, COUNT(*) as count
      FROM "Message"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    // 24時間分のデータを整形
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      conversations: 0,
      messages: 0,
    }));

    conversations.forEach((c) => {
      hourlyData[Number(c.hour)].conversations = Number(c.count);
    });
    messages.forEach((m) => {
      hourlyData[Number(m.hour)].messages = Number(m.count);
    });

    return hourlyData;
  }

  /**
   * 日別トレンドレポート
   */
  async getDailyTrendReport(startDate: Date, endDate: Date) {
    const conversations = await this.prisma.$queryRaw<
      { date: Date; count: bigint }[]
    >`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "Conversation"
      WHERE "createdAt" >= ${startDate} AND "createdAt" <= ${endDate}
      GROUP BY DATE("createdAt")
      ORDER BY date
    `;

    return conversations.map((c) => ({
      date: c.date,
      count: Number(c.count),
    }));
  }

  /**
   * レポート生成
   */
  async generateReport(
    type: 'daily' | 'weekly' | 'monthly',
    format: 'pdf' | 'csv' | 'json',
    startDate?: Date,
    endDate?: Date,
  ) {
    const now = new Date();
    let start: Date;
    let end: Date = endDate || now;

    // 期間設定
    switch (type) {
      case 'daily':
        start = startDate || new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = startDate || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // レポートデータ取得
    const reportData = await this.getPeriodSummary(start, end);

    // フォーマット別処理
    let content: any;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = JSON.stringify(reportData, null, 2);
        mimeType = 'application/json';
        break;
      case 'csv':
        content = this.convertToCSV(reportData);
        mimeType = 'text/csv';
        break;
      case 'pdf':
        // PDF生成は別途実装が必要（puppeteer等）
        content = JSON.stringify(reportData, null, 2);
        mimeType = 'application/json';
        this.logger.warn('PDF format is not yet implemented, returning JSON');
        break;
    }

    return {
      type,
      format,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      data: reportData,
      content,
      mimeType,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * レポート一覧取得（ScheduledTaskから生成されたレポート）
   */
  async getReports(type?: string, limit: number = 50) {
    const where: any = {};
    if (type) {
      where.taskType = 'report';
      where.config = {
        path: ['reportType'],
        equals: type,
      };
    } else {
      where.taskType = 'report';
    }

    const tasks = await this.prisma.scheduledTask.findMany({
      where,
      orderBy: { lastRunAt: 'desc' },
      take: limit,
    });

    return tasks.map((task) => ({
      id: task.id,
      name: task.name,
      type: (task.config as any)?.reportType,
      format: (task.config as any)?.format,
      lastRunAt: task.lastRunAt,
      nextRunAt: task.nextRunAt,
      lastResult: task.lastResult,
    }));
  }

  /**
   * レポートスケジュール設定
   */
  async scheduleReport(
    name: string,
    type: 'daily' | 'weekly' | 'monthly',
    format: 'pdf' | 'csv' | 'json',
    cronExpression: string,
    recipients?: string[],
  ) {
    const task = await this.prisma.scheduledTask.create({
      data: {
        name,
        taskType: 'report',
        cronExpression,
        config: {
          reportType: type,
          format,
          recipients,
        },
        isEnabled: true,
      },
    });

    this.logger.log(`Scheduled report created: ${name} (${type})`);

    return {
      id: task.id,
      name: task.name,
      type,
      format,
      cronExpression: task.cronExpression,
      recipients,
      createdAt: task.createdAt,
    };
  }

  /**
   * CSVフォーマット変換
   */
  private convertToCSV(data: any): string {
    const lines: string[] = [];

    // ヘッダー
    lines.push('Section,Metric,Value');

    // 会話統計
    lines.push(`Conversations,Total,${data.conversations.total}`);
    Object.entries(data.conversations.byStatus).forEach(([status, count]) => {
      lines.push(`Conversations,Status ${status},${count}`);
    });
    lines.push(
      `Conversations,Avg Duration (min),${data.conversations.averageDurationMinutes}`,
    );

    // メッセージ統計
    lines.push(`Messages,Total,${data.messages.total}`);
    Object.entries(data.messages.bySenderType).forEach(([type, count]) => {
      lines.push(`Messages,${type},${count}`);
    });

    // 満足度統計
    lines.push(`Surveys,Total,${data.surveys.total}`);
    lines.push(`Surveys,Avg Rating,${data.surveys.averageRating}`);
    lines.push(`Surveys,NPS Score,${data.surveys.npsScore}`);

    // ユーザー統計
    lines.push(`Users,New Users,${data.users.newUsers}`);
    lines.push(`Users,Active Users,${data.users.activeUsers}`);

    return lines.join('\n');
  }
}
