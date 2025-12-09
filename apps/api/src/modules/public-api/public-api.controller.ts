import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { StatisticsService } from '../statistics/statistics.service';

@Controller('api/v1')
@UseGuards(ApiKeyGuard)
export class PublicApiController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statisticsService: StatisticsService,
  ) {}

  /**
   * GET /api/v1/conversations - 会話一覧
   */
  @Get('conversations')
  async getConversations(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              sessionId: true,
              name: true,
              email: true,
            },
          },
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 100,
        skip: offset ? parseInt(offset) : 0,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return {
      data: conversations,
      pagination: {
        total,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
      },
    };
  }

  /**
   * GET /api/v1/conversations/:id - 会話詳細
   */
  @Get('conversations/:id')
  async getConversation(@Param('id') id: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            sessionId: true,
            name: true,
            email: true,
            phone: true,
            company: true,
            metadata: true,
          },
        },
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            senderType: true,
            contentType: true,
            content: true,
            payload: true,
            isRead: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation) {
      return { error: 'Conversation not found' };
    }

    return { data: conversation };
  }

  /**
   * GET /api/v1/conversations/:id/messages - メッセージ取得
   */
  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit ? parseInt(limit) : 100,
        skip: offset ? parseInt(offset) : 0,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return {
      data: messages,
      pagination: {
        total,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
      },
    };
  }

  /**
   * GET /api/v1/statistics - 統計取得
   */
  @Get('statistics')
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.statisticsService.getDashboardKPIs(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return { data: stats };
  }

  /**
   * GET /api/v1/users - ユーザー一覧
   */
  @Get('users')
  async getUsers(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { sessionId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          sessionId: true,
          name: true,
          email: true,
          phone: true,
          company: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(limit) : 100,
        skip: offset ? parseInt(offset) : 0,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        total,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
      },
    };
  }

  /**
   * GET /api/v1/health - ヘルスチェック
   */
  @Get('health')
  async health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
