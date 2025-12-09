import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SlaPolicyData {
  name: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  priority?: number;
  conditions?: Record<string, unknown>;
  escalationMinutes?: number;
  escalationTo?: string;
  isEnabled?: boolean;
}

@Injectable()
export class SlaService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== SLAポリシー管理 =====

  async createPolicy(data: SlaPolicyData) {
    return this.prisma.slaPolicy.create({
      data: {
        name: data.name,
        firstResponseMinutes: data.firstResponseMinutes,
        resolutionMinutes: data.resolutionMinutes,
        priority: data.priority ?? 0,
        conditions: data.conditions as Prisma.InputJsonValue ?? {},
        escalationMinutes: data.escalationMinutes,
        escalationTo: data.escalationTo,
        isEnabled: data.isEnabled ?? true,
      },
    });
  }

  async getPolicies(enabledOnly = false) {
    return this.prisma.slaPolicy.findMany({
      where: enabledOnly ? { isEnabled: true } : undefined,
      orderBy: { priority: 'desc' },
    });
  }

  async getPolicy(id: string) {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { id },
    });
    if (!policy) {
      throw new NotFoundException('SLA policy not found');
    }
    return policy;
  }

  async updatePolicy(id: string, data: Partial<SlaPolicyData>) {
    const updateData: Prisma.SlaPolicyUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.firstResponseMinutes !== undefined) updateData.firstResponseMinutes = data.firstResponseMinutes;
    if (data.resolutionMinutes !== undefined) updateData.resolutionMinutes = data.resolutionMinutes;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.conditions !== undefined) updateData.conditions = data.conditions as Prisma.InputJsonValue;
    if (data.escalationMinutes !== undefined) updateData.escalationMinutes = data.escalationMinutes;
    if (data.escalationTo !== undefined) updateData.escalationTo = data.escalationTo;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    return this.prisma.slaPolicy.update({
      where: { id },
      data: updateData,
    });
  }

  async deletePolicy(id: string) {
    return this.prisma.slaPolicy.delete({ where: { id } });
  }

  // ===== SLAトラッキング =====

  // 会話にSLAを適用
  async applyPolicyToConversation(conversationId: string, policyId: string) {
    const policy = await this.getPolicy(policyId);

    const now = new Date();
    const firstResponseDue = new Date(now.getTime() + policy.firstResponseMinutes * 60 * 1000);
    const resolutionDue = new Date(now.getTime() + policy.resolutionMinutes * 60 * 1000);

    // 既存のトラッキングを確認
    const existing = await this.prisma.slaTracking.findUnique({
      where: { conversationId },
    });

    if (existing) {
      return this.prisma.slaTracking.update({
        where: { conversationId },
        data: {
          policyId,
          firstResponseDue,
          resolutionDue,
          isBreached: false,
        },
      });
    }

    return this.prisma.slaTracking.create({
      data: {
        conversationId,
        policyId,
        firstResponseDue,
        resolutionDue,
      },
    });
  }

  // 最初の応答を記録
  async recordFirstResponse(conversationId: string) {
    const tracking = await this.prisma.slaTracking.findUnique({
      where: { conversationId },
    });

    if (!tracking) {
      return null; // SLAが適用されていない
    }

    if (tracking.firstResponseAt) {
      return tracking; // 既に記録済み
    }

    const now = new Date();
    const breached = tracking.firstResponseDue ? now > tracking.firstResponseDue : false;

    return this.prisma.slaTracking.update({
      where: { conversationId },
      data: {
        firstResponseAt: now,
        isBreached: breached || tracking.isBreached,
        breachType: breached ? 'first_response' : tracking.breachType,
      },
    });
  }

  // 解決を記録
  async recordResolution(conversationId: string) {
    const tracking = await this.prisma.slaTracking.findUnique({
      where: { conversationId },
    });

    if (!tracking) {
      return null;
    }

    const now = new Date();
    const breached = tracking.resolutionDue ? now > tracking.resolutionDue : false;

    return this.prisma.slaTracking.update({
      where: { conversationId },
      data: {
        resolvedAt: now,
        isBreached: breached || tracking.isBreached,
        breachType: breached && !tracking.breachType ? 'resolution' : tracking.breachType,
      },
    });
  }

  // 会話のSLA状態を取得
  async getConversationSla(conversationId: string) {
    const tracking = await this.prisma.slaTracking.findUnique({
      where: { conversationId },
    });

    if (!tracking) {
      return null;
    }

    const now = new Date();
    const firstResponseRemaining = tracking.firstResponseAt || !tracking.firstResponseDue
      ? null
      : Math.max(0, tracking.firstResponseDue.getTime() - now.getTime()) / 1000;
    const resolutionRemaining = tracking.resolvedAt || !tracking.resolutionDue
      ? null
      : Math.max(0, tracking.resolutionDue.getTime() - now.getTime()) / 1000;

    return {
      ...tracking,
      firstResponseRemaining,
      resolutionRemaining,
      isFirstResponseOverdue: !tracking.firstResponseAt && tracking.firstResponseDue && now > tracking.firstResponseDue,
      isResolutionOverdue: !tracking.resolvedAt && tracking.resolutionDue && now > tracking.resolutionDue,
    };
  }

  // SLA違反の会話を取得
  async getBreachedConversations() {
    const now = new Date();

    return this.prisma.slaTracking.findMany({
      where: {
        resolvedAt: null,
        OR: [
          { isBreached: true },
          { firstResponseAt: null, firstResponseDue: { lt: now } },
          { resolvedAt: null, resolutionDue: { lt: now } },
        ],
      },
      orderBy: { resolutionDue: 'asc' },
    });
  }

  // 間もなくSLA違反になる会話を取得
  async getAtRiskConversations(thresholdMinutes = 15) {
    const now = new Date();
    const threshold = new Date(now.getTime() + thresholdMinutes * 60 * 1000);

    return this.prisma.slaTracking.findMany({
      where: {
        isBreached: false,
        resolvedAt: null,
        OR: [
          { firstResponseAt: null, firstResponseDue: { gt: now, lt: threshold } },
          { resolutionDue: { gt: now, lt: threshold } },
        ],
      },
      orderBy: { resolutionDue: 'asc' },
    });
  }

  // SLA統計を取得
  async getSlaStats(startDate?: Date, endDate?: Date) {
    const where: Prisma.SlaTrackingWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const [total, breached, resolved] = await Promise.all([
      this.prisma.slaTracking.count({ where }),
      this.prisma.slaTracking.count({ where: { ...where, isBreached: true } }),
      this.prisma.slaTracking.count({ where: { ...where, resolvedAt: { not: null } } }),
    ]);

    // 平均応答時間を計算
    const withFirstResponse = await this.prisma.slaTracking.findMany({
      where: { ...where, firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true },
    });

    let avgFirstResponseTime: number | null = null;
    if (withFirstResponse.length > 0) {
      const totalTime = withFirstResponse.reduce((sum, t) => {
        return sum + (t.firstResponseAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgFirstResponseTime = Math.round(totalTime / withFirstResponse.length / 1000);
    }

    // 平均解決時間を計算
    const withResolution = await this.prisma.slaTracking.findMany({
      where: { ...where, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    });

    let avgResolutionTime: number | null = null;
    if (withResolution.length > 0) {
      const totalTime = withResolution.reduce((sum, t) => {
        return sum + (t.resolvedAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgResolutionTime = Math.round(totalTime / withResolution.length / 1000);
    }

    return {
      total,
      breached,
      resolved,
      active: total - resolved,
      slaAchievementRate: resolved > 0 ? Math.round(((resolved - breached) / resolved) * 100) : null,
      avgFirstResponseTimeSeconds: avgFirstResponseTime,
      avgResolutionTimeSeconds: avgResolutionTime,
    };
  }

  // ポリシー別の統計
  async getStatsByPolicy(startDate?: Date, endDate?: Date) {
    const policies = await this.prisma.slaPolicy.findMany();

    const stats = await Promise.all(
      policies.map(async (policy) => {
        const where: Prisma.SlaTrackingWhereInput = { policyId: policy.id };
        if (startDate || endDate) {
          where.createdAt = {};
          if (startDate) where.createdAt.gte = startDate;
          if (endDate) where.createdAt.lte = endDate;
        }

        const [total, breached, resolved] = await Promise.all([
          this.prisma.slaTracking.count({ where }),
          this.prisma.slaTracking.count({ where: { ...where, isBreached: true } }),
          this.prisma.slaTracking.count({ where: { ...where, resolvedAt: { not: null } } }),
        ]);

        return {
          policy: { id: policy.id, name: policy.name },
          total,
          breached,
          resolved,
          achievementRate: resolved > 0 ? Math.round(((resolved - breached) / resolved) * 100) : null,
        };
      })
    );

    return stats;
  }
}
