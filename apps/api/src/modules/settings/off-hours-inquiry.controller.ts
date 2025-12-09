import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { InquiryStatus } from '@prisma/client';

interface UpdateInquiryDto {
  status?: InquiryStatus;
  note?: string;
  assignedAdminId?: string;
}

interface ReplyEmailDto {
  subject: string;
  body: string;
}

@ApiTags('off-hours-inquiries')
@Controller('api/off-hours-inquiries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OffHoursInquiryController {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  @Get()
  @ApiOperation({ summary: '時間外問い合わせ一覧取得' })
  async findAll(
    @Query('status') status?: InquiryStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const where = status ? { status } : {};

    const [items, total] = await Promise.all([
      this.prisma.offHoursInquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      this.prisma.offHoursInquiry.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('pending-count')
  @ApiOperation({ summary: '未対応件数を取得' })
  async getPendingCount() {
    const count = await this.prisma.offHoursInquiry.count({
      where: { status: 'PENDING' },
    });
    return { count };
  }

  @Get(':id')
  @ApiOperation({ summary: '時間外問い合わせ詳細取得' })
  async findOne(@Param('id') id: string) {
    return this.prisma.offHoursInquiry.findUnique({
      where: { id },
    });
  }

  @Get(':id/related-chats')
  @ApiOperation({ summary: '関連チャット履歴を取得（同じメールアドレスのユーザー）' })
  async getRelatedChats(@Param('id') id: string) {
    // 問い合わせ情報を取得
    const inquiry = await this.prisma.offHoursInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      return { items: [] };
    }

    // 同じメールアドレスを持つユーザーのチャット履歴を取得
    const users = await this.prisma.user.findMany({
      where: { email: inquiry.email },
      select: { id: true },
    });

    if (users.length === 0) {
      return { items: [] };
    }

    const userIds = users.map(u => u.id);

    const conversations = await this.prisma.conversation.findMany({
      where: {
        userId: { in: userIds },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        messages: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            senderType: true,
            content: true,
            createdAt: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return { items: conversations };
  }

  @Patch(':id')
  @ApiOperation({ summary: '時間外問い合わせ更新（ステータス変更等）' })
  async update(@Param('id') id: string, @Body() dto: UpdateInquiryDto) {
    const data: {
      status?: InquiryStatus;
      note?: string;
      assignedAdminId?: string;
      resolvedAt?: Date | null;
    } = {};

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === 'RESOLVED') {
        data.resolvedAt = new Date();
      } else {
        data.resolvedAt = null;
      }
    }
    if (dto.note !== undefined) {
      data.note = dto.note;
    }
    if (dto.assignedAdminId !== undefined) {
      data.assignedAdminId = dto.assignedAdminId;
    }

    return this.prisma.offHoursInquiry.update({
      where: { id },
      data,
    });
  }

  @Post(':id/reply')
  @ApiOperation({ summary: '問い合わせへの返信メールを送信' })
  async sendReply(@Param('id') id: string, @Body() dto: ReplyEmailDto) {
    // 問い合わせ情報を取得
    const inquiry = await this.prisma.offHoursInquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      return { success: false, message: '問い合わせが見つかりません' };
    }

    try {
      // メール送信
      await this.notificationService.sendInquiryReplyEmail({
        toEmail: inquiry.email,
        toName: inquiry.name,
        subject: dto.subject,
        body: dto.body,
        originalInquiry: inquiry.content,
      });

      // ステータスを対応中に更新（まだPENDINGの場合）
      if (inquiry.status === 'PENDING') {
        await this.prisma.offHoursInquiry.update({
          where: { id },
          data: { status: 'IN_PROGRESS' },
        });
      }

      // ノートに返信履歴を追記
      const replyLog = `[${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}] 返信メール送信\n件名: ${dto.subject}\n本文:\n${dto.body}\n\n`;
      const updatedNote = inquiry.note ? `${inquiry.note}${replyLog}` : replyLog;

      await this.prisma.offHoursInquiry.update({
        where: { id },
        data: { note: updatedNote },
      });

      return { success: true, message: '返信メールを送信しました' };
    } catch (error) {
      console.error('Reply email error:', error);
      return { success: false, message: 'メール送信に失敗しました' };
    }
  }
}
