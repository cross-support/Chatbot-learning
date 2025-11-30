import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConversationStatus } from '@prisma/client';

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, metadata?: Record<string, unknown>) {
    return this.prisma.conversation.create({
      data: {
        userId,
        metadata: metadata as object | undefined,
        status: 'BOT',
      },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
      },
    });
  }

  async findById(id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        user: true,
        admin: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return conversation;
  }

  async findAll(params: {
    status?: ConversationStatus;
    assignedAdminId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { status, assignedAdminId, limit = 50, offset = 0 } = params;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (assignedAdminId) where.assignedAdminId = assignedAdminId;

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          user: true,
          admin: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return { conversations, total };
  }

  async updateStatus(id: string, status: ConversationStatus) {
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        status,
        closedAt: status === 'CLOSED' ? new Date() : undefined,
      },
      include: {
        user: true,
        admin: true,
      },
    });

    return conversation;
  }

  async assignAdmin(id: string, adminId: string) {
    const conversation = await this.prisma.conversation.update({
      where: { id },
      data: {
        assignedAdminId: adminId,
        status: 'HUMAN',
      },
      include: {
        user: true,
        admin: true,
      },
    });

    return conversation;
  }

  async close(id: string) {
    return this.updateStatus(id, 'CLOSED');
  }

  async getWaitingCount() {
    return this.prisma.conversation.count({
      where: { status: 'WAITING' },
    });
  }

  async getActiveByAdmin(adminId: string) {
    return this.prisma.conversation.findMany({
      where: {
        assignedAdminId: adminId,
        status: 'HUMAN',
      },
      include: {
        user: true,
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }
}
