import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SenderType, ContentType } from '@prisma/client';

interface CreateMessageDto {
  conversationId: string;
  senderType: SenderType | 'USER' | 'ADMIN' | 'BOT' | 'SYSTEM';
  contentType: ContentType | 'TEXT' | 'IMAGE' | 'OPTION_SELECT' | 'OPTION_PROMPT' | 'LINK' | 'FORM' | 'INTERNAL_MEMO';
  content: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateMessageDto) {
    return this.prisma.message.create({
      data: {
        conversationId: dto.conversationId,
        senderType: dto.senderType as SenderType,
        contentType: dto.contentType as ContentType,
        content: dto.content,
        payload: (dto.payload || {}) as object,
      },
    });
  }

  async findByConversation(conversationId: string, params?: { limit?: number; beforeId?: string }) {
    const { limit = 50, beforeId } = params || {};

    // beforeIdが指定された場合、そのメッセージより前のメッセージを取得
    let cursor: { id: string } | undefined;
    if (beforeId) {
      cursor = { id: beforeId };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        cursor,
        skip: 1, // カーソル自体はスキップ
      }),
    });

    // 古い順に並び替えて返す
    return messages.reverse();
  }

  async markAsRead(conversationIdOrMessageIds: string | string[], senderType?: SenderType | string) {
    // 引数が配列の場合はメッセージIDのリストとして処理（旧APIとの互換性）
    if (Array.isArray(conversationIdOrMessageIds)) {
      await this.prisma.message.updateMany({
        where: { id: { in: conversationIdOrMessageIds } },
        data: { isRead: true },
      });
    } else {
      // 会話IDとsenderTypeで既読にする
      await this.prisma.message.updateMany({
        where: {
          conversationId: conversationIdOrMessageIds,
          senderType: senderType as SenderType,
          isRead: false,
        },
        data: { isRead: true },
      });
    }
  }

  async markAllAsRead(conversationId: string) {
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        isRead: false,
      },
      data: { isRead: true },
    });
  }

  async getUnreadCount(conversationId: string, senderType: SenderType) {
    return this.prisma.message.count({
      where: {
        conversationId,
        senderType,
        isRead: false,
      },
    });
  }

  async findInternalMemos(conversationId: string) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        contentType: 'INTERNAL_MEMO',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countUserMessages(conversationId: string) {
    return this.prisma.message.count({
      where: {
        conversationId,
        senderType: 'USER',
      },
    });
  }
}
