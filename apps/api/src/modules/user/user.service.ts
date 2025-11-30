import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        visitLogs: {
          orderBy: { visitedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    return user;
  }

  async findBySessionId(sessionId: string) {
    return this.prisma.user.findUnique({
      where: { sessionId },
    });
  }

  async createSession() {
    const sessionId = uuidv4();
    const user = await this.prisma.user.create({
      data: { sessionId },
    });

    return { sessionId, userId: user.id };
  }

  async update(id: string, data: { name?: string; email?: string; phone?: string; company?: string; memo?: string }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async getVisitLogs(id: string, limit = 20) {
    return this.prisma.visitLog.findMany({
      where: { userId: id },
      orderBy: { visitedAt: 'desc' },
      take: limit,
    });
  }

  async getConversationHistory(id: string, limit = 10) {
    return this.prisma.conversation.findMany({
      where: { userId: id },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
