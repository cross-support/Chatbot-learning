import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

interface UserContext {
  url: string;
  title: string;
  userAgent: string;
  lmsUser?: {
    id: string;
    name: string;
    email?: string;
  };
}

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateUser(sessionId: string, context: UserContext) {
    let user = await this.prisma.user.findUnique({
      where: { sessionId },
    });

    const metadata = this.parseUserAgent(context.userAgent);

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          sessionId,
          name: context.lmsUser?.name,
          email: context.lmsUser?.email,
          lmsUserId: context.lmsUser?.id,
          metadata: {
            ...metadata,
            initialUrl: context.url,
            initialTitle: context.title,
          },
        },
      });
    } else {
      // メタデータを更新
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: context.lmsUser?.name || user.name,
          email: context.lmsUser?.email || user.email,
          lmsUserId: context.lmsUser?.id || user.lmsUserId,
          metadata: {
            ...(user.metadata as object || {}),
            ...metadata,
            lastUrl: context.url,
            lastTitle: context.title,
          },
        },
      });
    }

    // 訪問ログを記録
    await this.recordPageView(user.id, context.url, context.title);

    return user;
  }

  async recordPageView(userId: string, url: string, title?: string) {
    await this.prisma.visitLog.create({
      data: {
        id: uuidv4(),
        userId,
        url,
        pageTitle: title,
      },
    });
  }

  async getVisitLogs(userId: string, limit = 10) {
    return this.prisma.visitLog.findMany({
      where: { userId },
      orderBy: { visitedAt: 'desc' },
      take: limit,
    });
  }

  private parseUserAgent(userAgent: string) {
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const isTablet = /tablet|ipad/i.test(userAgent);

    let deviceType: 'PC' | 'Mobile' | 'Tablet' = 'PC';
    if (isTablet) deviceType = 'Tablet';
    else if (isMobile) deviceType = 'Mobile';

    let browser = 'Unknown';
    if (/chrome/i.test(userAgent) && !/edge/i.test(userAgent)) browser = 'Chrome';
    else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = 'Safari';
    else if (/firefox/i.test(userAgent)) browser = 'Firefox';
    else if (/edge/i.test(userAgent)) browser = 'Edge';

    let os = 'Unknown';
    if (/windows/i.test(userAgent)) os = 'Windows';
    else if (/macintosh|mac os/i.test(userAgent)) os = 'macOS';
    else if (/iphone|ipad|ipod/i.test(userAgent)) {
      const match = userAgent.match(/OS (\d+[_\.]\d+[_\.\d]*)/);
      os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
    }
    else if (/android/i.test(userAgent)) {
      const match = userAgent.match(/Android (\d+[\.\d]*)/);
      os = match ? `Android ${match[1]}` : 'Android';
    }
    else if (/linux/i.test(userAgent)) os = 'Linux';

    return {
      userAgent,
      browser,
      os,
      deviceType,
    };
  }

  async generateSessionId(): Promise<string> {
    return uuidv4();
  }
}
