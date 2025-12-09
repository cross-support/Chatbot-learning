import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SurveyService {
  private readonly logger = new Logger(SurveyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 満足度調査を送信
   */
  async submitSurvey(data: {
    conversationId: string;
    rating: number;
    feedback?: string;
    categories?: string[];
  }) {
    // 既存の回答があれば更新
    return this.prisma.satisfactionSurvey.upsert({
      where: { conversationId: data.conversationId },
      update: {
        rating: data.rating,
        feedback: data.feedback,
        categories: data.categories || [],
      },
      create: {
        conversationId: data.conversationId,
        rating: data.rating,
        feedback: data.feedback,
        categories: data.categories || [],
      },
    });
  }

  /**
   * 会話の満足度調査結果を取得
   */
  async getSurvey(conversationId: string) {
    return this.prisma.satisfactionSurvey.findUnique({
      where: { conversationId },
    });
  }

  /**
   * 満足度統計を取得
   */
  async getStatistics(startDate?: Date, endDate?: Date) {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const surveys = await this.prisma.satisfactionSurvey.findMany({ where });

    if (surveys.length === 0) {
      return {
        totalResponses: 0,
        averageRating: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        categoryBreakdown: {},
        npsScore: 0,
      };
    }

    // 評価分布
    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    surveys.forEach((s) => {
      ratingDistribution[s.rating] = (ratingDistribution[s.rating] || 0) + 1;
    });

    // 平均評価
    const averageRating =
      surveys.reduce((sum, s) => sum + s.rating, 0) / surveys.length;

    // カテゴリ別集計
    const categoryBreakdown: Record<string, number> = {};
    surveys.forEach((s) => {
      s.categories.forEach((cat) => {
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
      });
    });

    // NPS（Net Promoter Score）計算
    // 4-5: Promoter, 3: Passive, 1-2: Detractor
    const promoters = surveys.filter((s) => s.rating >= 4).length;
    const detractors = surveys.filter((s) => s.rating <= 2).length;
    const npsScore = Math.round(
      ((promoters - detractors) / surveys.length) * 100,
    );

    return {
      totalResponses: surveys.length,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      categoryBreakdown,
      npsScore,
    };
  }

  /**
   * 最近の回答一覧
   */
  async getRecentSurveys(limit = 50) {
    return this.prisma.satisfactionSurvey.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 低評価の回答を取得（改善対象）
   */
  async getLowRatingSurveys(maxRating = 2, limit = 100) {
    return this.prisma.satisfactionSurvey.findMany({
      where: { rating: { lte: maxRating } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
