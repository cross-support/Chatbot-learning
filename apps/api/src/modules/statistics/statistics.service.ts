import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardKPIs(startDate?: Date, endDate?: Date) {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || now;

    // 総会話数
    const totalConversations = await this.prisma.conversation.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    // 今日の会話数
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayConversations = await this.prisma.conversation.count({
      where: {
        createdAt: {
          gte: todayStart,
        },
      },
    });

    // 平均応答時間と解決時間を計算
    const conversations = await this.prisma.conversation.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: ConversationStatus.CLOSED,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let responseCount = 0;
    let resolutionCount = 0;

    conversations.forEach((conv) => {
      if (conv.messages.length >= 2) {
        const firstUserMsg = conv.messages.find((m) => m.senderType === 'USER');
        const firstAdminMsg = conv.messages.find((m) => m.senderType === 'ADMIN');
        if (firstUserMsg && firstAdminMsg) {
          const responseTime =
            firstAdminMsg.createdAt.getTime() - firstUserMsg.createdAt.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }

      if (conv.closedAt) {
        const resolutionTime = conv.closedAt.getTime() - conv.startedAt.getTime();
        totalResolutionTime += resolutionTime;
        resolutionCount++;
      }
    });

    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount / 1000 : 0;
    const avgResolutionTime =
      resolutionCount > 0 ? totalResolutionTime / resolutionCount / 1000 : 0;

    // NPS計算
    const npsScore = await this.calculateNPS(start, end);

    // 解決率
    const closedConversations = await this.prisma.conversation.count({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
        status: ConversationStatus.CLOSED,
      },
    });
    const resolutionRate =
      totalConversations > 0 ? (closedConversations / totalConversations) * 100 : 0;

    // 時間帯別トレンド（過去7日間）
    const hourlyConversations = await this.getHourlyTrend(7);

    // 日別トレンド（過去30日間）
    const dailyConversations = await this.getDailyTrend(30);

    // 満足度推移（過去7日間）
    const satisfactionTrend = await this.getDailySatisfactionTrend(7);

    // オペレーター別パフォーマンス
    const operatorPerformance = await this.getOperatorPerformance(start, end);

    return {
      totalConversations,
      todayConversations,
      avgResponseTime: Math.round(avgResponseTime),
      avgResolutionTime: Math.round(avgResolutionTime),
      npsScore,
      resolutionRate: resolutionRate / 100, // 0-1の範囲に変換
      hourlyConversations,
      dailyConversations,
      satisfactionTrend,
      operatorPerformance,
    };
  }

  async getOperatorStats(startDate?: Date, endDate?: Date) {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || now;

    const admins = await this.prisma.admin.findMany({
      include: {
        conversations: {
          where: {
            createdAt: {
              gte: start,
              lte: end,
            },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    const operatorStats = await Promise.all(
      admins.map(async (admin) => {
        const handledCount = admin.conversations.length;
        let totalResponseTime = 0;
        let totalHandleTime = 0;
        let responseCount = 0;
        let handleCount = 0;

        admin.conversations.forEach((conv) => {
          if (conv.messages.length >= 2) {
            const firstUserMsg = conv.messages.find((m) => m.senderType === 'USER');
            const firstAdminMsg = conv.messages.find((m) => m.senderType === 'ADMIN');
            if (firstUserMsg && firstAdminMsg) {
              const responseTime =
                firstAdminMsg.createdAt.getTime() - firstUserMsg.createdAt.getTime();
              totalResponseTime += responseTime;
              responseCount++;
            }
          }

          if (conv.closedAt) {
            const handleTime = conv.closedAt.getTime() - conv.startedAt.getTime();
            totalHandleTime += handleTime;
            handleCount++;
          }
        });

        const avgResponseTime =
          responseCount > 0 ? Math.round(totalResponseTime / responseCount / 1000) : 0;
        const avgHandleTime =
          handleCount > 0 ? Math.round(totalHandleTime / handleCount / 1000) : 0;

        // 満足度平均
        const conversationIds = admin.conversations.map((c) => c.id);
        const surveys = await this.prisma.satisfactionSurvey.findMany({
          where: {
            conversationId: {
              in: conversationIds,
            },
          },
        });

        const satisfactionAvg =
          surveys.length > 0
            ? surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length
            : 0;

        // 解決率
        const closedCount = admin.conversations.filter(
          (c) => c.status === ConversationStatus.CLOSED,
        ).length;
        const resolutionRate = handledCount > 0 ? (closedCount / handledCount) * 100 : 0;

        return {
          adminId: admin.id,
          name: admin.name,
          handledCount,
          avgResponseTime,
          avgHandleTime,
          satisfactionAvg: Math.round(satisfactionAvg * 10) / 10,
          resolutionRate: Math.round(resolutionRate * 10) / 10,
        };
      }),
    );

    return operatorStats;
  }

  async getSurveyStats(startDate?: Date, endDate?: Date) {
    const now = new Date();
    const start = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || now;

    const surveys = await this.prisma.satisfactionSurvey.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const totalSurveys = surveys.length;
    const avgRating =
      totalSurveys > 0 ? surveys.reduce((sum, s) => sum + s.rating, 0) / totalSurveys : 0;

    // NPS計算
    const npsScore = await this.calculateNPS(start, end);

    // 評価分布
    const ratingDistribution = [0, 0, 0, 0, 0]; // 1-5
    surveys.forEach((s) => {
      if (s.rating >= 1 && s.rating <= 5) {
        ratingDistribution[s.rating - 1]++;
      }
    });

    // カテゴリ別内訳
    const categoryBreakdown: Record<string, number> = {};
    surveys.forEach((s) => {
      s.categories.forEach((cat) => {
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });
    });

    // 日別トレンド
    const dailyTrend = await this.getDailySurveyTrend(30);

    return {
      totalSurveys,
      avgRating: Math.round(avgRating * 10) / 10,
      npsScore,
      ratingDistribution,
      categoryBreakdown,
      dailyTrend,
    };
  }

  private async calculateNPS(startDate: Date, endDate: Date): Promise<number> {
    const surveys = await this.prisma.satisfactionSurvey.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    if (surveys.length === 0) return 0;

    const promoters = surveys.filter((s) => s.rating >= 4).length;
    const detractors = surveys.filter((s) => s.rating <= 3).length;
    const total = surveys.length;

    const promoterPercent = (promoters / total) * 100;
    const detractorPercent = (detractors / total) * 100;

    return Math.round(promoterPercent - detractorPercent);
  }

  private async getHourlyTrend(days: number) {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        createdAt: {
          gte: start,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const hourlyData: number[] = new Array(24).fill(0);
    conversations.forEach((conv) => {
      const hour = conv.createdAt.getHours();
      hourlyData[hour]++;
    });

    return hourlyData.map((count, hour) => ({
      hour,
      count,
    }));
  }

  private async getDailyTrend(days: number) {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        createdAt: {
          gte: start,
        },
      },
      select: {
        createdAt: true,
      },
    });

    const dailyMap: Record<string, number> = {};
    conversations.forEach((conv) => {
      const date = conv.createdAt.toISOString().split('T')[0];
      dailyMap[date] = (dailyMap[date] || 0) + 1;
    });

    return Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
    }));
  }

  private async getDailySurveyTrend(days: number) {
    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const surveys = await this.prisma.satisfactionSurvey.findMany({
      where: {
        createdAt: {
          gte: start,
        },
      },
      select: {
        createdAt: true,
        rating: true,
      },
    });

    const dailyMap: Record<string, { count: number; totalRating: number }> = {};
    surveys.forEach((survey) => {
      const date = survey.createdAt.toISOString().split('T')[0];
      if (!dailyMap[date]) {
        dailyMap[date] = { count: 0, totalRating: 0 };
      }
      dailyMap[date].count++;
      dailyMap[date].totalRating += survey.rating;
    });

    return Object.entries(dailyMap).map(([date, data]) => ({
      date,
      count: data.count,
      avgRating: Math.round((data.totalRating / data.count) * 10) / 10,
    }));
  }

  private async getDailySatisfactionTrend(days: number) {
    const now = new Date();
    const result: { date: string; score: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const surveys = await this.prisma.satisfactionSurvey.findMany({
        where: {
          createdAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        select: {
          rating: true,
        },
      });

      const avgScore =
        surveys.length > 0
          ? surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length
          : 0;

      result.push({
        date: dateStr,
        score: Math.round(avgScore * 10) / 10,
      });
    }

    return result;
  }

  private async getOperatorPerformance(startDate: Date, endDate: Date) {
    const admins = await this.prisma.admin.findMany({
      include: {
        conversations: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    const result = await Promise.all(
      admins.map(async (admin) => {
        const handledCount = admin.conversations.length;
        let totalResponseTime = 0;
        let responseCount = 0;

        admin.conversations.forEach((conv) => {
          if (conv.messages.length >= 2) {
            const firstUserMsg = conv.messages.find((m) => m.senderType === 'USER');
            const firstAdminMsg = conv.messages.find((m) => m.senderType === 'ADMIN');
            if (firstUserMsg && firstAdminMsg) {
              const responseTime =
                firstAdminMsg.createdAt.getTime() - firstUserMsg.createdAt.getTime();
              totalResponseTime += responseTime;
              responseCount++;
            }
          }
        });

        const avgResponseTime =
          responseCount > 0 ? Math.round(totalResponseTime / responseCount / 1000) : 0;

        // 満足度平均
        const conversationIds = admin.conversations.map((c) => c.id);
        const surveys = await this.prisma.satisfactionSurvey.findMany({
          where: {
            conversationId: {
              in: conversationIds,
            },
          },
        });

        const satisfaction =
          surveys.length > 0
            ? surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length
            : 0;

        return {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          handledCount,
          avgResponseTime,
          satisfaction: Math.round(satisfaction * 10) / 10,
        };
      }),
    );

    return result.filter((op) => op.handledCount > 0);
  }
}
