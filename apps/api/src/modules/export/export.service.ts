import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 会話履歴をCSV形式でエクスポート
   */
  async exportConversations(params: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<string> {
    const where: Record<string, unknown> = {};
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }
    if (params.status) where.status = params.status;

    const conversations = await this.prisma.conversation.findMany({
      where,
      include: {
        user: true,
        admin: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      '会話ID',
      'ステータス',
      'ユーザー名',
      'メールアドレス',
      '担当者',
      'メッセージ数',
      '開始日時',
      '終了日時',
    ];

    const rows = conversations.map((conv) => [
      conv.id,
      conv.status,
      conv.user.name || '-',
      conv.user.email || '-',
      conv.admin?.name || '-',
      conv.messages.length.toString(),
      conv.createdAt.toISOString(),
      conv.closedAt?.toISOString() || '-',
    ]);

    return this.toCSV(headers, rows);
  }

  /**
   * メッセージをCSV形式でエクスポート
   */
  async exportMessages(conversationId?: string): Promise<string> {
    const where = conversationId ? { conversationId } : {};

    const messages = await this.prisma.message.findMany({
      where,
      include: {
        conversation: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const headers = [
      'メッセージID',
      '会話ID',
      '送信者タイプ',
      'コンテンツタイプ',
      '内容',
      '日時',
    ];

    const rows = messages.map((msg) => [
      msg.id,
      msg.conversationId,
      msg.senderType,
      msg.contentType,
      msg.content.replace(/[\n\r]/g, ' '),
      msg.createdAt.toISOString(),
    ]);

    return this.toCSV(headers, rows);
  }

  /**
   * ユーザー一覧をCSV形式でエクスポート
   */
  async exportUsers(): Promise<string> {
    const users = await this.prisma.user.findMany({
      include: {
        _count: {
          select: { conversations: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'ユーザーID',
      'セッションID',
      '名前',
      'メールアドレス',
      '電話番号',
      '会社名',
      '会話数',
      '登録日時',
    ];

    const rows = users.map((user) => [
      user.id,
      user.sessionId,
      user.name || '-',
      user.email || '-',
      user.phone || '-',
      user.company || '-',
      user._count.conversations.toString(),
      user.createdAt.toISOString(),
    ]);

    return this.toCSV(headers, rows);
  }

  /**
   * 時間外問い合わせをCSV形式でエクスポート
   */
  async exportInquiries(params: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
  }): Promise<string> {
    const where: Record<string, unknown> = {};
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) (where.createdAt as Record<string, Date>).gte = params.startDate;
      if (params.endDate) (where.createdAt as Record<string, Date>).lte = params.endDate;
    }
    if (params.status) where.status = params.status;

    const inquiries = await this.prisma.offHoursInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const headers = [
      'ID',
      '氏名',
      'メールアドレス',
      '会社名',
      '内容',
      'ステータス',
      '管理者メモ',
      '受付日時',
      '対応完了日時',
    ];

    const rows = inquiries.map((inq) => [
      inq.id,
      inq.name,
      inq.email,
      inq.company || '-',
      inq.content.replace(/[\n\r]/g, ' '),
      inq.status,
      inq.note?.replace(/[\n\r]/g, ' ') || '-',
      inq.createdAt.toISOString(),
      inq.resolvedAt?.toISOString() || '-',
    ]);

    return this.toCSV(headers, rows);
  }

  /**
   * 統計データをCSV形式でエクスポート
   */
  async exportStatistics(params: {
    startDate: Date;
    endDate: Date;
  }): Promise<string> {
    const { startDate, endDate } = params;

    // 日別の統計を計算
    const days: string[] = [];
    const current = new Date(startDate);
    while (current <= endDate) {
      days.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const headers = [
      '日付',
      '新規会話数',
      'クローズ会話数',
      'メッセージ数',
      '新規ユーザー数',
      '問い合わせ数',
    ];

    const rows: string[][] = [];

    for (const day of days) {
      const dayStart = new Date(day);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const [newConv, closedConv, messages, newUsers, inquiries] = await Promise.all([
        this.prisma.conversation.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } },
        }),
        this.prisma.conversation.count({
          where: { closedAt: { gte: dayStart, lte: dayEnd } },
        }),
        this.prisma.message.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } },
        }),
        this.prisma.user.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } },
        }),
        this.prisma.offHoursInquiry.count({
          where: { createdAt: { gte: dayStart, lte: dayEnd } },
        }),
      ]);

      rows.push([
        day,
        newConv.toString(),
        closedConv.toString(),
        messages.toString(),
        newUsers.toString(),
        inquiries.toString(),
      ]);
    }

    return this.toCSV(headers, rows);
  }

  /**
   * CSVフォーマットに変換
   */
  private toCSV(headers: string[], rows: string[][]): string {
    const escapeField = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const lines = [
      headers.map(escapeField).join(','),
      ...rows.map((row) => row.map(escapeField).join(',')),
    ];

    // BOM付きUTF-8
    return '\ufeff' + lines.join('\n');
  }
}
