import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * ポリシーを作成/更新
   */
  async upsertPolicy(data: {
    entity: string;
    retentionDays: number;
    isEnabled?: boolean;
  }) {
    return this.prisma.dataRetentionPolicy.upsert({
      where: { entity: data.entity },
      update: {
        retentionDays: data.retentionDays,
        isEnabled: data.isEnabled ?? true,
      },
      create: {
        entity: data.entity,
        retentionDays: data.retentionDays,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  /**
   * ポリシー一覧を取得
   */
  async getPolicies() {
    return this.prisma.dataRetentionPolicy.findMany({
      orderBy: { entity: 'asc' },
    });
  }

  /**
   * ポリシーを削除
   */
  async deletePolicy(id: string) {
    return this.prisma.dataRetentionPolicy.delete({
      where: { id },
    });
  }

  /**
   * データクリーンアップを実行
   */
  async executeRetention(): Promise<{
    entity: string;
    deletedCount: number;
  }[]> {
    const policies = await this.prisma.dataRetentionPolicy.findMany({
      where: { isEnabled: true },
    });

    const results: { entity: string; deletedCount: number }[] = [];

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      let deletedCount = 0;

      try {
        switch (policy.entity) {
          case 'messages':
            const messageResult = await this.prisma.message.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deletedCount = messageResult.count;
            break;

          case 'visit_logs':
            const visitResult = await this.prisma.visitLog.deleteMany({
              where: { visitedAt: { lt: cutoffDate } },
            });
            deletedCount = visitResult.count;
            break;

          case 'audit_logs':
            const auditResult = await this.prisma.auditLog.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deletedCount = auditResult.count;
            break;

          case 'security_logs':
            const securityResult = await this.prisma.securityLog.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deletedCount = securityResult.count;
            break;

          case 'webhook_logs':
            const webhookResult = await this.prisma.webhookEventLog.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deletedCount = webhookResult.count;
            break;

          case 'alert_history':
            const alertResult = await this.prisma.alertHistory.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deletedCount = alertResult.count;
            break;

          case 'closed_conversations':
            const convResult = await this.prisma.conversation.deleteMany({
              where: {
                status: 'CLOSED',
                closedAt: { lt: cutoffDate },
              },
            });
            deletedCount = convResult.count;
            break;

          default:
            this.logger.warn(`Unknown entity type: ${policy.entity}`);
            continue;
        }

        results.push({ entity: policy.entity, deletedCount });

        // 実行日時を更新
        await this.prisma.dataRetentionPolicy.update({
          where: { id: policy.id },
          data: { lastExecutedAt: new Date() },
        });

        this.logger.log(
          `Retention cleanup for ${policy.entity}: deleted ${deletedCount} records`,
        );
      } catch (error) {
        this.logger.error(`Retention cleanup failed for ${policy.entity}`, error);
      }
    }

    return results;
  }

  /**
   * デフォルトポリシーを初期化
   */
  async initializeDefaultPolicies() {
    const defaults = [
      { entity: 'messages', retentionDays: 365 },
      { entity: 'visit_logs', retentionDays: 90 },
      { entity: 'audit_logs', retentionDays: 730 },
      { entity: 'security_logs', retentionDays: 365 },
      { entity: 'webhook_logs', retentionDays: 30 },
      { entity: 'alert_history', retentionDays: 90 },
      { entity: 'closed_conversations', retentionDays: 365 },
    ];

    for (const policy of defaults) {
      await this.prisma.dataRetentionPolicy.upsert({
        where: { entity: policy.entity },
        update: {},
        create: policy,
      });
    }

    return this.getPolicies();
  }
}
