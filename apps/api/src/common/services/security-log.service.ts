import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SecurityLogType =
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_change'
  | 'account_locked'
  | 'account_unlocked'
  | 'api_key_created'
  | 'api_key_deleted'
  | 'permission_change';

interface LogDetails {
  adminId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class SecurityLogService {
  private readonly logger = new Logger(SecurityLogService.name);

  constructor(private prisma: PrismaService) {}

  async log(type: SecurityLogType, details: LogDetails) {
    try {
      await this.prisma.securityLog.create({
        data: {
          type,
          adminId: details.adminId,
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          details: details.details as object | undefined,
        },
      });

      this.logger.log(`Security event: ${type}`, {
        adminId: details.adminId,
        ip: details.ipAddress,
      });
    } catch (error) {
      this.logger.error(`Failed to log security event: ${type}`, error);
    }
  }

  async getRecentLogs(params: {
    adminId?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const { adminId, type, limit = 50, offset = 0 } = params;

    const where: Record<string, unknown> = {};
    if (adminId) where.adminId = adminId;
    if (type) where.type = type;

    const [logs, total] = await Promise.all([
      this.prisma.securityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.securityLog.count({ where }),
    ]);

    return { logs, total };
  }

  async getLoginAttempts(ipAddress: string, minutes: number = 15) {
    const since = new Date(Date.now() - minutes * 60 * 1000);

    return this.prisma.securityLog.count({
      where: {
        type: 'login_failure',
        ipAddress,
        createdAt: { gte: since },
      },
    });
  }

  async cleanupOldLogs(days: number = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await this.prisma.securityLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(`Cleaned up ${result.count} old security logs`);
    return result.count;
  }
}
