import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditContext {
  adminId?: string;
  adminEmail?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * 監査ログを記録
   */
  async log(
    action: string,
    entity: string,
    context: AuditContext,
    options?: {
      entityId?: string;
      oldValue?: unknown;
      newValue?: unknown;
    },
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          entity,
          entityId: options?.entityId,
          adminId: context.adminId,
          adminEmail: context.adminEmail,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          oldValue: options?.oldValue ? JSON.parse(JSON.stringify(options.oldValue)) : null,
          newValue: options?.newValue ? JSON.parse(JSON.stringify(options.newValue)) : null,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * 監査ログを検索
   */
  async findLogs(params: {
    adminId?: string;
    action?: string;
    entity?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    const { adminId, action, entity, startDate, endDate, page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (adminId) where.adminId = adminId;
    if (action) where.action = action;
    if (entity) where.entity = entity;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = startDate;
      if (endDate) (where.createdAt as Record<string, Date>).lte = endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * エンティティの変更履歴を取得
   */
  async getEntityHistory(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 管理者の操作履歴を取得
   */
  async getAdminActivity(adminId: string, limit = 100) {
    return this.prisma.auditLog.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
