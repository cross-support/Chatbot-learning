import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class CobrowseService {
  private readonly logger = new Logger(CobrowseService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * コブラウズセッションを作成
   */
  async createSession(data: {
    conversationId: string;
    adminId: string;
    userId: string;
  }) {
    const sessionCode = this.generateSessionCode();

    const session = await this.prisma.cobrowseSession.create({
      data: {
        conversationId: data.conversationId,
        adminId: data.adminId,
        userId: data.userId,
        sessionCode,
        status: 'pending',
      },
    });

    this.logger.log(`Created cobrowse session: ${session.id} with code: ${sessionCode}`);
    return session;
  }

  /**
   * セッションコードでセッションを取得
   */
  async getSessionByCode(sessionCode: string) {
    const session = await this.prisma.cobrowseSession.findUnique({
      where: { sessionCode },
    });

    if (!session) {
      throw new NotFoundException('セッションが見つかりません');
    }

    return session;
  }

  /**
   * セッションを取得
   */
  async getSession(id: string) {
    const session = await this.prisma.cobrowseSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new NotFoundException('セッションが見つかりません');
    }

    return session;
  }

  /**
   * セッションに参加（ユーザー側）
   */
  async joinSession(sessionCode: string) {
    const session = await this.getSessionByCode(sessionCode);

    if (session.status !== 'pending') {
      throw new Error('このセッションには参加できません');
    }

    return this.prisma.cobrowseSession.update({
      where: { id: session.id },
      data: {
        status: 'active',
        startedAt: new Date(),
      },
    });
  }

  /**
   * セッションを終了
   */
  async endSession(id: string) {
    const session = await this.getSession(id);

    return this.prisma.cobrowseSession.update({
      where: { id: session.id },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });
  }

  /**
   * 会話に関連するセッションを取得
   */
  async getSessionsByConversation(conversationId: string) {
    return this.prisma.cobrowseSession.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * アクティブなセッション一覧を取得
   */
  async getActiveSessions() {
    return this.prisma.cobrowseSession.findMany({
      where: { status: 'active' },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * 管理者のセッション履歴を取得
   */
  async getAdminSessions(adminId: string, limit = 50) {
    return this.prisma.cobrowseSession.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * WebRTC接続用のシグナリング情報を生成
   * （実際のWebRTC実装はフロントエンドで行う）
   */
  generateSignalingInfo(sessionId: string) {
    return {
      sessionId,
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      signalingUrl: `/api/cobrowse/${sessionId}/signal`,
    };
  }

  /**
   * セッション統計を取得
   */
  async getSessionStats(startDate?: Date, endDate?: Date) {
    const where: Record<string, unknown> = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [total, active, completed] = await Promise.all([
      this.prisma.cobrowseSession.count({ where }),
      this.prisma.cobrowseSession.count({ where: { ...where, status: 'active' } }),
      this.prisma.cobrowseSession.count({ where: { ...where, status: 'ended' } }),
    ]);

    // 平均セッション時間
    const completedSessions = await this.prisma.cobrowseSession.findMany({
      where: { ...where, status: 'ended', startedAt: { not: null }, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });

    let avgDurationMinutes = 0;
    if (completedSessions.length > 0) {
      const totalDuration = completedSessions.reduce((sum, s) => {
        if (s.startedAt && s.endedAt) {
          return sum + (s.endedAt.getTime() - s.startedAt.getTime());
        }
        return sum;
      }, 0);
      avgDurationMinutes = Math.round(totalDuration / completedSessions.length / 60000);
    }

    return {
      total,
      active,
      completed,
      pending: total - active - completed,
      avgDurationMinutes,
    };
  }

  /**
   * 期限切れのpendingセッションをクリーンアップ
   */
  async cleanupExpiredSessions(expiryMinutes = 30) {
    const threshold = new Date();
    threshold.setMinutes(threshold.getMinutes() - expiryMinutes);

    const result = await this.prisma.cobrowseSession.updateMany({
      where: {
        status: 'pending',
        createdAt: { lt: threshold },
      },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired cobrowse sessions`);
    }

    return result.count;
  }

  // ===== プライベートメソッド =====

  private generateSessionCode(): string {
    // 6桁の英数字コード
    return crypto.randomBytes(3).toString('hex').toUpperCase();
  }
}
