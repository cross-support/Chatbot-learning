import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ConversationTagService {
  private readonly logger = new Logger(ConversationTagService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * タグを作成
   */
  async createTag(data: { name: string; color?: string }) {
    return this.prisma.conversationTag.create({
      data: {
        name: data.name,
        color: data.color || '#6B7280',
      },
    });
  }

  /**
   * タグ一覧を取得
   */
  async getTags() {
    return this.prisma.conversationTag.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });
  }

  /**
   * タグを更新
   */
  async updateTag(id: string, data: { name?: string; color?: string }) {
    return this.prisma.conversationTag.update({
      where: { id },
      data,
    });
  }

  /**
   * タグを削除
   */
  async deleteTag(id: string) {
    return this.prisma.conversationTag.delete({
      where: { id },
    });
  }

  /**
   * 会話にタグを付与
   */
  async assignTag(conversationId: string, tagId: string, assignedBy?: string) {
    return this.prisma.conversationTagAssignment.upsert({
      where: {
        conversationId_tagId: { conversationId, tagId },
      },
      create: {
        conversationId,
        tagId,
        assignedBy,
      },
      update: {},
    });
  }

  /**
   * 会話からタグを削除
   */
  async removeTag(conversationId: string, tagId: string) {
    return this.prisma.conversationTagAssignment.delete({
      where: {
        conversationId_tagId: { conversationId, tagId },
      },
    });
  }

  /**
   * 会話のタグ一覧を取得
   */
  async getConversationTags(conversationId: string) {
    const assignments = await this.prisma.conversationTagAssignment.findMany({
      where: { conversationId },
      include: { tag: true },
    });
    return assignments.map((a) => a.tag);
  }

  /**
   * タグで会話を検索
   */
  async findConversationsByTags(tagIds: string[], matchAll = false) {
    if (matchAll) {
      // すべてのタグを持つ会話
      const conversationIds = await this.prisma.conversationTagAssignment.groupBy({
        by: ['conversationId'],
        where: { tagId: { in: tagIds } },
        having: {
          conversationId: { _count: { equals: tagIds.length } },
        },
      });
      return conversationIds.map((c) => c.conversationId);
    } else {
      // いずれかのタグを持つ会話
      const assignments = await this.prisma.conversationTagAssignment.findMany({
        where: { tagId: { in: tagIds } },
        select: { conversationId: true },
        distinct: ['conversationId'],
      });
      return assignments.map((a) => a.conversationId);
    }
  }

  /**
   * タグ統計
   */
  async getTagStats() {
    const tags = await this.prisma.conversationTag.findMany({
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      count: tag._count.assignments,
    }));
  }

  /**
   * 複数タグを一括付与
   */
  async assignMultipleTags(
    conversationId: string,
    tagIds: string[],
    assignedBy?: string,
  ) {
    const results = await Promise.all(
      tagIds.map((tagId) => this.assignTag(conversationId, tagId, assignedBy)),
    );
    return { count: results.length };
  }

  /**
   * 会話のタグを置換
   */
  async replaceConversationTags(
    conversationId: string,
    tagIds: string[],
    assignedBy?: string,
  ) {
    // 既存のタグを削除
    await this.prisma.conversationTagAssignment.deleteMany({
      where: { conversationId },
    });

    // 新しいタグを付与
    if (tagIds.length > 0) {
      await this.prisma.conversationTagAssignment.createMany({
        data: tagIds.map((tagId) => ({
          conversationId,
          tagId,
          assignedBy,
        })),
      });
    }

    return this.getConversationTags(conversationId);
  }
}
