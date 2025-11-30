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
        payload: dto.payload || {},
      },
    });
  }

  async findByConversation(conversationId: string, params?: { limit?: number; before?: Date }) {
    const { limit = 50, before } = params || {};

    return this.prisma.message.findMany({
      where: {
        conversationId,
        ...(before && { createdAt: { lt: before } }),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async markAsRead(messageIds: string[]) {
    await this.prisma.message.updateMany({
      where: { id: { in: messageIds } },
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
}
