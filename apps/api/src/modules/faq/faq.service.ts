import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  // FAQ一覧（全件）
  async getAllFaqs() {
    return this.prisma.fAQSuggestion.findMany({
      orderBy: [
        { frequency: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  // FAQ一覧（承認済み）
  async getApprovedFaqs() {
    return this.prisma.fAQSuggestion.findMany({
      where: {
        isApproved: true,
      },
      orderBy: [
        { frequency: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  // 提案一覧（未承認含む）
  async getSuggestions(status?: string, sortBy: string = 'frequency') {
    const where: any = {};

    if (status === 'approved') {
      where.isApproved = true;
    } else if (status === 'pending') {
      where.isApproved = false;
    }

    const orderBy: any = {};
    if (sortBy === 'frequency') {
      orderBy.frequency = 'desc';
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = 'desc';
    } else {
      orderBy.updatedAt = 'desc';
    }

    return this.prisma.fAQSuggestion.findMany({
      where,
      orderBy,
    });
  }

  // 類似質問検索（簡易的な部分一致）
  async searchSimilar(query: string) {
    // 簡易的な検索：質問文に検索クエリが含まれるものを返す
    const faqs = await this.prisma.fAQSuggestion.findMany({
      where: {
        isApproved: true,
        question: {
          contains: query,
          mode: 'insensitive',
        },
      },
      orderBy: {
        frequency: 'desc',
      },
      take: 5,
    });

    // スコアリング（簡易的：完全一致 > 前方一致 > 部分一致）
    const scoredFaqs = faqs.map((faq: { question: string; [key: string]: unknown }) => {
      let score = 0;
      const lowerQuestion = faq.question.toLowerCase();
      const lowerQuery = query.toLowerCase();

      if (lowerQuestion === lowerQuery) {
        score = 100; // 完全一致
      } else if (lowerQuestion.startsWith(lowerQuery)) {
        score = 80; // 前方一致
      } else if (lowerQuestion.includes(lowerQuery)) {
        score = 60; // 部分一致
      }

      return {
        ...faq,
        score,
      };
    });

    return scoredFaqs
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 5);
  }

  // FAQ手動追加
  async createFaq(createDto: { question: string; answer: string }) {
    return this.prisma.fAQSuggestion.create({
      data: {
        question: createDto.question,
        answer: createDto.answer,
        frequency: 0,
        isApproved: true, // 手動追加は即承認
      },
    });
  }

  // 提案を承認
  async approveSuggestion(id: string) {
    const suggestion = await this.prisma.fAQSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    return this.prisma.fAQSuggestion.update({
      where: { id },
      data: {
        isApproved: true,
      },
    });
  }

  // 提案を却下（削除）
  async rejectSuggestion(id: string) {
    const suggestion = await this.prisma.fAQSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    return this.prisma.fAQSuggestion.delete({
      where: { id },
    });
  }

  // FAQ更新
  async updateFaq(
    id: string,
    updateDto: { question?: string; answer?: string },
  ) {
    const faq = await this.prisma.fAQSuggestion.findUnique({
      where: { id },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return this.prisma.fAQSuggestion.update({
      where: { id },
      data: updateDto,
    });
  }

  // FAQ削除
  async deleteFaq(id: string) {
    const faq = await this.prisma.fAQSuggestion.findUnique({
      where: { id },
    });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    return this.prisma.fAQSuggestion.delete({
      where: { id },
    });
  }

  // FAQ統計
  async getStats() {
    const total = await this.prisma.fAQSuggestion.count();
    const approved = await this.prisma.fAQSuggestion.count({
      where: { isApproved: true },
    });
    const pending = await this.prisma.fAQSuggestion.count({
      where: { isApproved: false },
    });

    const topFaqs = await this.prisma.fAQSuggestion.findMany({
      where: { isApproved: true },
      orderBy: { frequency: 'desc' },
      take: 10,
    });

    return {
      total,
      approved,
      pending,
      topFaqs,
    };
  }

  // 頻度インクリメント（チャット機能から呼ばれる想定）
  async incrementFrequency(id: string) {
    return this.prisma.fAQSuggestion.update({
      where: { id },
      data: {
        frequency: {
          increment: 1,
        },
      },
    });
  }

  // 新しい質問を提案として追加（チャット機能から呼ばれる想定）
  async createSuggestion(question: string) {
    // 既存の類似質問をチェック
    const existing = await this.prisma.fAQSuggestion.findFirst({
      where: {
        question: {
          equals: question,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      // 既存の場合は頻度を増やす
      return this.incrementFrequency(existing.id);
    } else {
      // 新規提案として追加
      return this.prisma.fAQSuggestion.create({
        data: {
          question,
          frequency: 1,
          isApproved: false, // 自動追加は未承認
        },
      });
    }
  }

  /**
   * ナレッジベース統合検索
   * FAQ、テンプレート、シナリオノードを横断検索
   */
  async searchKnowledge(query: string, limit = 10) {
    const results: {
      type: 'faq' | 'template' | 'scenario';
      id: string;
      title: string;
      content: string;
      score: number;
      category?: string;
    }[] = [];

    const lowerQuery = query.toLowerCase();

    // 1. FAQ検索
    const faqs = await this.prisma.fAQSuggestion.findMany({
      where: {
        isApproved: true,
        OR: [
          { question: { contains: query, mode: 'insensitive' } },
          { answer: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    faqs.forEach((faq) => {
      let score = 0;
      const lowerQuestion = faq.question.toLowerCase();
      const lowerAnswer = (faq.answer || '').toLowerCase();

      if (lowerQuestion === lowerQuery) {
        score = 100;
      } else if (lowerQuestion.startsWith(lowerQuery)) {
        score = 85;
      } else if (lowerQuestion.includes(lowerQuery)) {
        score = 70;
      } else if (lowerAnswer.includes(lowerQuery)) {
        score = 50;
      }

      // 頻度による加点
      score += Math.min(faq.frequency * 2, 20);

      results.push({
        type: 'faq',
        id: faq.id,
        title: faq.question,
        content: faq.answer || '',
        score,
        category: 'FAQ',
      });
    });

    // 2. テンプレート検索
    const templates = await this.prisma.template.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { content: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    templates.forEach((template) => {
      let score = 0;
      const lowerName = template.name.toLowerCase();
      const lowerContent = template.content.toLowerCase();
      const lowerCode = template.code.toLowerCase();

      if (lowerName === lowerQuery || lowerCode === lowerQuery) {
        score = 100;
      } else if (lowerName.startsWith(lowerQuery)) {
        score = 80;
      } else if (lowerName.includes(lowerQuery)) {
        score = 65;
      } else if (lowerContent.includes(lowerQuery)) {
        score = 45;
      }

      results.push({
        type: 'template',
        id: template.id,
        title: `[${template.code}] ${template.name}`,
        content: template.content,
        score,
        category: template.category || 'テンプレート',
      });
    });

    // 3. シナリオノード検索
    const scenarioNodes = await this.prisma.scenarioNode.findMany({
      where: {
        isActive: true,
        OR: [
          { triggerText: { contains: query, mode: 'insensitive' } },
          { responseText: { contains: query, mode: 'insensitive' } },
          { nodeName: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        scenario: {
          select: { name: true },
        },
      },
      take: limit,
    });

    scenarioNodes.forEach((node) => {
      let score = 0;
      const lowerTrigger = node.triggerText.toLowerCase();
      const lowerResponse = (node.responseText || '').toLowerCase();
      const lowerNodeName = (node.nodeName || '').toLowerCase();

      if (lowerTrigger === lowerQuery || lowerNodeName === lowerQuery) {
        score = 95;
      } else if (lowerTrigger.startsWith(lowerQuery)) {
        score = 75;
      } else if (lowerTrigger.includes(lowerQuery)) {
        score = 60;
      } else if (lowerResponse.includes(lowerQuery)) {
        score = 40;
      }

      results.push({
        type: 'scenario',
        id: String(node.id),
        title: node.nodeName || node.triggerText,
        content: node.responseText || node.triggerText,
        score,
        category: node.scenario?.name || 'シナリオ',
      });
    });

    // スコア順にソートしてリミット適用
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
