import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import OpenAI from 'openai';

@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);
  private openai: OpenAI | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const apiKey = this.configService.get('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * ユーザーの質問を記録
   */
  async recordQuestion(data: {
    conversationId: string;
    question: string;
    matchedNodeId?: number;
    matchScore?: number;
    wasHandedOver?: boolean;
  }) {
    return this.prisma.userQuestion.create({
      data: {
        conversationId: data.conversationId,
        question: data.question,
        matchedNodeId: data.matchedNodeId,
        matchScore: data.matchScore,
        wasHandedOver: data.wasHandedOver ?? false,
      },
    });
  }

  /**
   * 未回答/低スコア質問を分析して改善提案を生成
   */
  async analyzeUnmatchedQuestions() {
    // 直近7日間のオペレーター引継ぎまたは低スコアの質問を取得
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const questions = await this.prisma.userQuestion.findMany({
      where: {
        createdAt: { gte: oneWeekAgo },
        OR: [
          { wasHandedOver: true },
          { matchScore: { lt: 0.5 } },
          { matchedNodeId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    if (questions.length === 0) {
      return { improvements: [], message: '分析対象の質問がありません' };
    }

    // 類似質問をグループ化
    const groupedQuestions = this.groupSimilarQuestions(questions);

    // 各グループに対して改善提案を生成
    const improvements: Array<{
      type: string;
      suggestion: string;
      confidence: number;
      basedOnCount: number;
      nodeId?: number;
    }> = [];

    for (const group of groupedQuestions) {
      if (group.count >= 3) {
        // 3回以上の類似質問は新規ノード追加を提案
        improvements.push({
          type: 'add_node',
          suggestion: `新しい質問パターン: "${group.representative}"への回答ノードを追加することを推奨`,
          confidence: Math.min(group.count / 10, 1),
          basedOnCount: group.count,
        });
      } else if (group.nodeId && group.count >= 2) {
        // 既存ノードに関連する質問は選択肢追加を提案
        improvements.push({
          type: 'add_option',
          suggestion: `ノード${group.nodeId}に「${group.representative}」への選択肢を追加することを推奨`,
          confidence: Math.min(group.count / 5, 1),
          basedOnCount: group.count,
          nodeId: group.nodeId,
        });
      }
    }

    // 改善提案をDBに保存
    for (const improvement of improvements) {
      await this.prisma.scenarioImprovement.create({
        data: {
          nodeId: improvement.nodeId,
          type: improvement.type,
          suggestion: improvement.suggestion,
          confidence: improvement.confidence,
          basedOnCount: improvement.basedOnCount,
        },
      });
    }

    return { improvements, analyzedCount: questions.length };
  }

  /**
   * AIを使って改善提案を詳細化
   */
  async generateDetailedSuggestion(improvementId: string) {
    if (!this.openai) {
      throw new Error('OpenAI APIが設定されていません');
    }

    const improvement = await this.prisma.scenarioImprovement.findUnique({
      where: { id: improvementId },
    });

    if (!improvement) {
      throw new Error('改善提案が見つかりません');
    }

    // 関連する質問を取得
    const relatedQuestions = await this.prisma.userQuestion.findMany({
      where: improvement.nodeId
        ? { matchedNodeId: improvement.nodeId }
        : { matchedNodeId: null },
      take: 20,
    });

    const prompt = `
以下のチャットボットの改善提案について、具体的な実装案を生成してください。

改善タイプ: ${improvement.type}
元の提案: ${improvement.suggestion}

関連するユーザー質問:
${relatedQuestions.map((q) => `- ${q.question}`).join('\n')}

以下の形式でJSON出力してください:
{
  "triggerText": "選択肢のラベル",
  "responseText": "ボットの応答文",
  "keywords": ["関連キーワード1", "関連キーワード2"]
}
`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AIからの応答がありません');
    }

    return JSON.parse(content);
  }

  /**
   * 改善提案一覧を取得
   */
  async getImprovements(status?: string) {
    return this.prisma.scenarioImprovement.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 改善提案のステータスを更新
   */
  async updateImprovementStatus(
    id: string,
    status: 'approved' | 'rejected',
    approvedBy?: string,
  ) {
    return this.prisma.scenarioImprovement.update({
      where: { id },
      data: {
        status,
        approvedBy,
        implementedAt: status === 'approved' ? new Date() : null,
      },
    });
  }

  /**
   * 質問パターン統計を取得
   */
  async getQuestionStats(startDate?: Date, endDate?: Date) {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [total, handedOver, lowScore, unmatched] = await Promise.all([
      this.prisma.userQuestion.count({ where }),
      this.prisma.userQuestion.count({ where: { ...where, wasHandedOver: true } }),
      this.prisma.userQuestion.count({ where: { ...where, matchScore: { lt: 0.5 } } }),
      this.prisma.userQuestion.count({ where: { ...where, matchedNodeId: null } }),
    ]);

    // よくマッチするノード
    const topMatchedNodes = await this.prisma.userQuestion.groupBy({
      by: ['matchedNodeId'],
      where: { ...where, matchedNodeId: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return {
      total,
      handedOver,
      handedOverRate: total > 0 ? ((handedOver / total) * 100).toFixed(2) : 0,
      lowScore,
      unmatched,
      topMatchedNodes: topMatchedNodes.map((n) => ({
        nodeId: n.matchedNodeId,
        count: n._count.id,
      })),
    };
  }

  // ===== プライベートメソッド =====

  private groupSimilarQuestions(
    questions: Array<{ question: string; matchedNodeId: number | null }>,
  ): Array<{ representative: string; count: number; nodeId?: number }> {
    // 簡易的なグループ化（実際はベクトル類似度などを使用）
    const groups = new Map<string, { count: number; nodeId?: number }>();

    for (const q of questions) {
      // 正規化（小文字、空白除去）
      const normalized = q.question.toLowerCase().trim();
      const key = normalized.slice(0, 50); // 最初の50文字でグループ化

      const existing = groups.get(key);
      if (existing) {
        existing.count++;
      } else {
        groups.set(key, { count: 1, nodeId: q.matchedNodeId ?? undefined });
      }
    }

    return Array.from(groups.entries())
      .map(([representative, data]) => ({
        representative,
        ...data,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
