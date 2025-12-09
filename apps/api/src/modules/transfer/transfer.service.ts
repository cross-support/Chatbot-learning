import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface TransferRequest {
  conversationId: string;
  fromAdminId: string;
  toAdminId: string;
  reason?: string;
  note?: string;
}

@Injectable()
export class TransferService {
  constructor(private readonly prisma: PrismaService) {}

  // 会話転送をリクエスト
  async requestTransfer(data: TransferRequest) {
    // 同じオペレーターへの転送を防止
    if (data.fromAdminId === data.toAdminId) {
      throw new BadRequestException('Cannot transfer to yourself');
    }

    // 転送先のオペレーターが存在するか確認
    const toAdmin = await this.prisma.admin.findUnique({
      where: { id: data.toAdminId },
    });
    if (!toAdmin) {
      throw new NotFoundException('Target operator not found');
    }

    // ペンディング中の転送がないか確認
    const pendingTransfer = await this.prisma.conversationTransfer.findFirst({
      where: {
        conversationId: data.conversationId,
        status: 'pending',
      },
    });
    if (pendingTransfer) {
      throw new BadRequestException('A transfer is already pending for this conversation');
    }

    return this.prisma.conversationTransfer.create({
      data: {
        conversationId: data.conversationId,
        fromAdminId: data.fromAdminId,
        toAdminId: data.toAdminId,
        reason: data.reason,
        note: data.note,
        status: 'pending',
      },
    });
  }

  // 転送を承認
  async acceptTransfer(transferId: string, adminId: string) {
    const transfer = await this.prisma.conversationTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not pending');
    }

    if (transfer.toAdminId !== adminId) {
      throw new BadRequestException('You are not the target of this transfer');
    }

    // トランザクションで転送処理を実行
    return this.prisma.$transaction(async (tx) => {
      // 転送ステータスを更新
      const updatedTransfer = await tx.conversationTransfer.update({
        where: { id: transferId },
        data: {
          status: 'accepted',
          acceptedAt: new Date(),
        },
      });

      // 会話の担当者を更新
      await tx.conversation.update({
        where: { id: transfer.conversationId },
        data: {
          assignedAdminId: transfer.toAdminId,
        },
      });

      return updatedTransfer;
    });
  }

  // 転送を拒否
  async rejectTransfer(transferId: string, adminId: string, rejectReason?: string) {
    const transfer = await this.prisma.conversationTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not pending');
    }

    if (transfer.toAdminId !== adminId) {
      throw new BadRequestException('You are not the target of this transfer');
    }

    return this.prisma.conversationTransfer.update({
      where: { id: transferId },
      data: {
        status: 'rejected',
        note: rejectReason
          ? `${transfer.note || ''}\n[Rejection reason]: ${rejectReason}`.trim()
          : transfer.note,
      },
    });
  }

  // 転送をキャンセル（リクエスト元のみ）
  async cancelTransfer(transferId: string, adminId: string) {
    const transfer = await this.prisma.conversationTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    if (transfer.status !== 'pending') {
      throw new BadRequestException('Transfer is not pending');
    }

    if (transfer.fromAdminId !== adminId) {
      throw new BadRequestException('Only the requester can cancel the transfer');
    }

    return this.prisma.conversationTransfer.update({
      where: { id: transferId },
      data: {
        status: 'cancelled',
      },
    });
  }

  // 受信した転送リクエストを取得
  async getIncomingTransfers(adminId: string) {
    return this.prisma.conversationTransfer.findMany({
      where: {
        toAdminId: adminId,
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 送信した転送リクエストを取得
  async getOutgoingTransfers(adminId: string) {
    return this.prisma.conversationTransfer.findMany({
      where: {
        fromAdminId: adminId,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // 会話の転送履歴を取得
  async getConversationTransferHistory(conversationId: string) {
    return this.prisma.conversationTransfer.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 転送可能なオペレーター一覧を取得
  async getAvailableOperators(excludeAdminId: string) {
    return this.prisma.admin.findMany({
      where: {
        id: { not: excludeAdminId },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });
  }

  // 転送統計を取得
  async getTransferStats(adminId?: string, startDate?: Date, endDate?: Date) {
    const where: Prisma.ConversationTransferWhereInput = {};

    if (adminId) {
      where.OR = [{ fromAdminId: adminId }, { toAdminId: adminId }];
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, pending, accepted, rejected, cancelled] = await Promise.all([
      this.prisma.conversationTransfer.count({ where }),
      this.prisma.conversationTransfer.count({ where: { ...where, status: 'pending' } }),
      this.prisma.conversationTransfer.count({ where: { ...where, status: 'accepted' } }),
      this.prisma.conversationTransfer.count({ where: { ...where, status: 'rejected' } }),
      this.prisma.conversationTransfer.count({ where: { ...where, status: 'cancelled' } }),
    ]);

    // 平均承認時間を計算
    const acceptedTransfers = await this.prisma.conversationTransfer.findMany({
      where: { ...where, status: 'accepted', acceptedAt: { not: null } },
      select: { createdAt: true, acceptedAt: true },
    });

    let avgAcceptTime: number | null = null;
    if (acceptedTransfers.length > 0) {
      const totalTime = acceptedTransfers.reduce((sum, t) => {
        return sum + (t.acceptedAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgAcceptTime = Math.round(totalTime / acceptedTransfers.length / 1000); // 秒単位
    }

    return {
      total,
      pending,
      accepted,
      rejected,
      cancelled,
      acceptRate: total > 0 ? Math.round((accepted / total) * 100) : 0,
      avgAcceptTimeSeconds: avgAcceptTime,
    };
  }
}
