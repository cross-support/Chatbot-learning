import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

interface SessionInfo {
  adminId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly SESSION_EXPIRY_HOURS = 24;
  private readonly INACTIVITY_TIMEOUT_MINUTES = 30;

  constructor(private prisma: PrismaService) {}

  public hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private parseUserAgent(userAgent?: string): string {
    if (!userAgent) return 'Unknown';

    const browser = userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera|MSIE|Trident)[\/\s](\d+)/i);
    const os = userAgent.match(/(Windows|Mac|Linux|Android|iOS)[^\)]*\)/i);

    const browserName = browser ? browser[1] : 'Unknown';
    const osName = os ? os[1] : 'Unknown';

    return `${browserName} on ${osName}`;
  }

  async createSession(info: SessionInfo) {
    const tokenHash = this.hashToken(info.token);
    const expiresAt = new Date(Date.now() + this.SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    return this.prisma.adminSession.create({
      data: {
        adminId: info.adminId,
        token: tokenHash,
        ipAddress: info.ipAddress,
        userAgent: info.userAgent,
        deviceInfo: this.parseUserAgent(info.userAgent),
        expiresAt,
      },
    });
  }

  async validateSession(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);

    const session = await this.prisma.adminSession.findUnique({
      where: { token: tokenHash },
    });

    if (!session) return false;

    // 有効期限チェック
    if (session.expiresAt < new Date()) {
      await this.deleteSession(token);
      return false;
    }

    // 非アクティブタイムアウトチェック
    const inactivityLimit = new Date(Date.now() - this.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000);
    if (session.lastActiveAt < inactivityLimit) {
      await this.deleteSession(token);
      return false;
    }

    // アクティブ時刻を更新
    await this.prisma.adminSession.update({
      where: { token: tokenHash },
      data: { lastActiveAt: new Date() },
    });

    return true;
  }

  async deleteSession(token: string) {
    const tokenHash = this.hashToken(token);

    try {
      await this.prisma.adminSession.delete({
        where: { token: tokenHash },
      });
    } catch {
      // セッションが存在しない場合は無視
    }
  }

  async deleteAllSessions(adminId: string) {
    await this.prisma.adminSession.deleteMany({
      where: { adminId },
    });
  }

  async getActiveSessions(adminId: string) {
    return this.prisma.adminSession.findMany({
      where: {
        adminId,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        ipAddress: true,
        deviceInfo: true,
        lastActiveAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async terminateSession(sessionId: string, adminId: string) {
    // 自分のセッションのみ削除可能
    await this.prisma.adminSession.deleteMany({
      where: { id: sessionId, adminId },
    });
  }

  async cleanupExpiredSessions() {
    const result = await this.prisma.adminSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    if (result.count > 0) {
      this.logger.log(`Cleaned up ${result.count} expired sessions`);
    }

    return result.count;
  }
}
