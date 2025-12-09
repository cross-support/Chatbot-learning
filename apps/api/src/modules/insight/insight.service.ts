import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

interface OpenAIResponse {
  choices: Array<{
    message?: {
      content?: string;
    };
  }>;
}

@Injectable()
export class InsightService {
  private readonly logger = new Logger(InsightService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * 会話を分析してインサイトを生成
   */
  async analyzeConversation(conversationId: string) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OpenAI API key not configured');
      return null;
    }

    // 会話メッセージを取得
    const messages = await this.prisma.message.findMany({
      where: { conversationId, contentType: 'TEXT' },
      orderBy: { createdAt: 'asc' },
    });

    if (messages.length < 2) return null;

    const conversationText = messages
      .map((m) => `${m.senderType}: ${m.content}`)
      .join('\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `以下の会話を分析し、JSON形式で回答してください:
{
  "sentiment": "positive" | "neutral" | "negative",
  "topics": ["トピック1", "トピック2"],
  "intent": "問い合わせの意図",
  "summary": "会話の要約（50字以内）",
  "suggestions": ["改善提案1", "改善提案2"]
}`,
            },
            { role: 'user', content: conversationText },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = (await response.json()) as OpenAIResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) return null;

      // JSONをパース
      const analysis = JSON.parse(content);

      // データベースに保存
      const insight = await this.prisma.conversationInsight.upsert({
        where: { conversationId },
        update: {
          sentiment: analysis.sentiment,
          topics: analysis.topics || [],
          intent: analysis.intent,
          summary: analysis.summary,
          suggestions: analysis.suggestions,
          analyzedAt: new Date(),
        },
        create: {
          conversationId,
          sentiment: analysis.sentiment,
          topics: analysis.topics || [],
          intent: analysis.intent,
          summary: analysis.summary,
          suggestions: analysis.suggestions,
        },
      });

      return insight;
    } catch (error) {
      this.logger.error('Conversation analysis failed', error);
      return null;
    }
  }

  /**
   * インサイトを取得
   */
  async getInsight(conversationId: string) {
    return this.prisma.conversationInsight.findUnique({
      where: { conversationId },
    });
  }

  /**
   * センチメント別の統計
   */
  async getSentimentStats(startDate?: Date, endDate?: Date) {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.analyzedAt = {};
      if (startDate) (where.analyzedAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.analyzedAt as Record<string, Date>).lte = endDate;
    }

    const insights = await this.prisma.conversationInsight.findMany({ where });

    const stats = {
      total: insights.length,
      positive: insights.filter((i) => i.sentiment === 'positive').length,
      neutral: insights.filter((i) => i.sentiment === 'neutral').length,
      negative: insights.filter((i) => i.sentiment === 'negative').length,
    };

    return stats;
  }

  /**
   * トピック頻度分析
   */
  async getTopicAnalysis(limit = 20) {
    const insights = await this.prisma.conversationInsight.findMany({
      select: { topics: true },
    });

    const topicCounts: Record<string, number> = {};
    insights.forEach((insight) => {
      insight.topics.forEach((topic) => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    });

    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * FAQ候補を抽出・更新
   */
  async updateFAQSuggestions() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) return [];

    // 最近のユーザーメッセージを取得
    const recentMessages = await this.prisma.message.findMany({
      where: {
        senderType: 'USER',
        contentType: 'TEXT',
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7日以内
        },
      },
      select: { content: true },
      take: 500,
    });

    if (recentMessages.length < 10) return [];

    const messageTexts = recentMessages.map((m) => m.content).join('\n---\n');

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: `以下のユーザー問い合わせから、よくある質問を抽出してJSON配列で返してください。
各項目は { "question": "質問文", "frequency": 推定頻度(1-10) } の形式です。
最大10件まで。`,
            },
            { role: 'user', content: messageTexts },
          ],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) return [];

      const data = (await response.json()) as OpenAIResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) return [];

      const suggestions = JSON.parse(content) as Array<{
        question: string;
        frequency: number;
      }>;

      // データベースに保存
      for (const suggestion of suggestions) {
        await this.prisma.fAQSuggestion.upsert({
          where: { id: suggestion.question }, // 仮のwhere
          update: { frequency: suggestion.frequency },
          create: {
            question: suggestion.question,
            frequency: suggestion.frequency,
          },
        });
      }

      return suggestions;
    } catch (error) {
      this.logger.error('FAQ extraction failed', error);
      return [];
    }
  }

  /**
   * FAQ候補一覧を取得
   */
  async getFAQSuggestions(onlyApproved = false) {
    return this.prisma.fAQSuggestion.findMany({
      where: onlyApproved ? { isApproved: true } : undefined,
      orderBy: { frequency: 'desc' },
    });
  }

  /**
   * FAQ候補を承認/却下
   */
  async updateFAQSuggestion(id: string, data: { isApproved?: boolean; answer?: string }) {
    return this.prisma.fAQSuggestion.update({
      where: { id },
      data,
    });
  }

  /**
   * 会話品質スコアを計算
   */
  async calculateQualityScore(conversationId: string): Promise<{
    overallScore: number;
    responseTimeScore: number;
    resolutionScore: number;
    sentimentScore: number;
    engagementScore: number;
    details: Record<string, unknown>;
  }> {
    // 会話データを取得
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return {
        overallScore: 0,
        responseTimeScore: 0,
        resolutionScore: 0,
        sentimentScore: 0,
        engagementScore: 0,
        details: {},
      };
    }

    const messages = conversation.messages;

    // 1. 応答時間スコア（0-100）
    let responseTimeScore = 100;
    let totalResponseTime = 0;
    let responseCount = 0;

    for (let i = 1; i < messages.length; i++) {
      const prev = messages[i - 1];
      const curr = messages[i];

      if (prev.senderType === 'USER' && (curr.senderType === 'ADMIN' || curr.senderType === 'BOT')) {
        const responseTime = (curr.createdAt.getTime() - prev.createdAt.getTime()) / 1000;
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    if (responseCount > 0) {
      const avgResponseTime = totalResponseTime / responseCount;
      // 30秒以内=100点、5分以上=0点で線形補間
      responseTimeScore = Math.max(0, Math.min(100, 100 - (avgResponseTime - 30) / (300 - 30) * 100));
    }

    // 2. 解決スコア（0-100）
    let resolutionScore = 50; // デフォルト
    if (conversation.status === 'CLOSED') {
      resolutionScore = 100;
    } else if (conversation.status === 'BOT') {
      resolutionScore = 70; // BOT対応中
    } else if (conversation.status === 'HUMAN') {
      resolutionScore = 60; // 有人対応中
    } else if (conversation.status === 'WAITING') {
      resolutionScore = 30; // 待機中
    }

    // 満足度調査がある場合
    const survey = await this.prisma.satisfactionSurvey.findUnique({
      where: { conversationId },
    });
    if (survey) {
      resolutionScore = Math.min(100, resolutionScore + survey.rating * 10);
    }

    // 3. センチメントスコア（0-100）
    let sentimentScore = 50;
    const insight = await this.prisma.conversationInsight.findUnique({
      where: { conversationId },
    });
    if (insight) {
      switch (insight.sentiment) {
        case 'positive':
          sentimentScore = 90;
          break;
        case 'neutral':
          sentimentScore = 60;
          break;
        case 'negative':
          sentimentScore = 30;
          break;
      }
    }

    // 4. エンゲージメントスコア（0-100）
    const userMessages = messages.filter((m) => m.senderType === 'USER').length;
    const adminMessages = messages.filter((m) => m.senderType === 'ADMIN' || m.senderType === 'BOT').length;
    const totalMessages = messages.length;

    // メッセージのバランスと量でスコアリング
    let engagementScore = 50;
    if (totalMessages > 0) {
      const balance = Math.min(userMessages, adminMessages) / Math.max(userMessages, adminMessages, 1);
      engagementScore = Math.min(100, 40 + balance * 30 + Math.min(totalMessages, 20) * 1.5);
    }

    // 総合スコア（重み付き平均）
    const weights = {
      responseTime: 0.25,
      resolution: 0.30,
      sentiment: 0.25,
      engagement: 0.20,
    };

    const overallScore = Math.round(
      responseTimeScore * weights.responseTime +
      resolutionScore * weights.resolution +
      sentimentScore * weights.sentiment +
      engagementScore * weights.engagement
    );

    return {
      overallScore,
      responseTimeScore: Math.round(responseTimeScore),
      resolutionScore: Math.round(resolutionScore),
      sentimentScore: Math.round(sentimentScore),
      engagementScore: Math.round(engagementScore),
      details: {
        totalMessages,
        userMessages,
        adminMessages,
        avgResponseTime: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
        hasSurvey: !!survey,
        surveyRating: survey?.rating,
        hasInsight: !!insight,
        sentiment: insight?.sentiment,
      },
    };
  }

  /**
   * 複数会話の品質スコアを一括取得
   */
  async getQualityScores(conversationIds: string[]): Promise<Map<string, number>> {
    const scores = new Map<string, number>();

    for (const id of conversationIds) {
      const result = await this.calculateQualityScore(id);
      scores.set(id, result.overallScore);
    }

    return scores;
  }

  /**
   * センチメント推移を取得
   */
  async getSentimentTrend(days: number = 7): Promise<{ date: string; positive: number; neutral: number; negative: number }[]> {
    const now = new Date();
    const result: { date: string; positive: number; neutral: number; negative: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const insights = await this.prisma.conversationInsight.findMany({
        where: {
          analyzedAt: {
            gte: dayStart,
            lt: dayEnd,
          },
        },
        select: { sentiment: true },
      });

      result.push({
        date: dateStr,
        positive: insights.filter((i) => i.sentiment === 'positive').length,
        neutral: insights.filter((i) => i.sentiment === 'neutral').length,
        negative: insights.filter((i) => i.sentiment === 'negative').length,
      });
    }

    return result;
  }
}
