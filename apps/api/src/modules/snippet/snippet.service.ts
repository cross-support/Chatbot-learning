import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SnippetService {
  private readonly logger = new Logger(SnippetService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * スニペットを作成
   */
  async createSnippet(data: {
    adminId?: string;
    title: string;
    content: string;
    shortcut?: string;
    category?: string;
    isShared?: boolean;
  }) {
    return this.prisma.snippet.create({
      data: {
        adminId: data.adminId,
        title: data.title,
        content: data.content,
        shortcut: data.shortcut,
        category: data.category,
        isShared: data.isShared ?? false,
      },
    });
  }

  /**
   * スニペット一覧を取得（個人＋共有）
   */
  async getSnippets(adminId: string, category?: string) {
    return this.prisma.snippet.findMany({
      where: {
        OR: [{ adminId }, { isShared: true }],
        ...(category ? { category } : {}),
      },
      orderBy: [{ usageCount: 'desc' }, { title: 'asc' }],
    });
  }

  /**
   * ショートカットでスニペットを検索
   */
  async findByShortcut(shortcut: string, adminId: string) {
    return this.prisma.snippet.findFirst({
      where: {
        shortcut,
        OR: [{ adminId }, { isShared: true }],
      },
    });
  }

  /**
   * スニペットを検索
   */
  async searchSnippets(query: string, adminId: string) {
    return this.prisma.snippet.findMany({
      where: {
        OR: [{ adminId }, { isShared: true }],
        AND: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { content: { contains: query, mode: 'insensitive' } },
            { shortcut: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
      orderBy: { usageCount: 'desc' },
      take: 20,
    });
  }

  /**
   * スニペットを取得
   */
  async getSnippet(id: string) {
    return this.prisma.snippet.findUnique({
      where: { id },
    });
  }

  /**
   * スニペットを更新
   */
  async updateSnippet(
    id: string,
    data: Partial<{
      title: string;
      content: string;
      shortcut: string;
      category: string;
      isShared: boolean;
    }>,
  ) {
    return this.prisma.snippet.update({
      where: { id },
      data,
    });
  }

  /**
   * スニペットを削除
   */
  async deleteSnippet(id: string) {
    return this.prisma.snippet.delete({
      where: { id },
    });
  }

  /**
   * 使用回数をインクリメント
   */
  async incrementUsage(id: string) {
    return this.prisma.snippet.update({
      where: { id },
      data: {
        usageCount: { increment: 1 },
      },
    });
  }

  /**
   * カテゴリ一覧を取得
   */
  async getCategories(adminId: string) {
    const snippets = await this.prisma.snippet.findMany({
      where: {
        OR: [{ adminId }, { isShared: true }],
        category: { not: null },
      },
      select: { category: true },
      distinct: ['category'],
    });
    return snippets.map((s) => s.category).filter(Boolean);
  }

  /**
   * 共有スニペット一覧
   */
  async getSharedSnippets() {
    return this.prisma.snippet.findMany({
      where: { isShared: true },
      orderBy: [{ usageCount: 'desc' }, { title: 'asc' }],
    });
  }

  /**
   * よく使うスニペット
   */
  async getTopSnippets(adminId: string, limit = 10) {
    return this.prisma.snippet.findMany({
      where: {
        OR: [{ adminId }, { isShared: true }],
      },
      orderBy: { usageCount: 'desc' },
      take: limit,
    });
  }
}
