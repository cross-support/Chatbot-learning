import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface AssignmentCondition {
  skills?: string[];
  languages?: string[];
  timeSlots?: { start: string; end: string }[];
  channels?: string[];
  keywords?: string[];
}

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);
  private roundRobinIndex = 0;

  constructor(private prisma: PrismaService) {}

  /**
   * 割り当てルールを作成
   */
  async createRule(data: {
    name: string;
    priority?: number;
    conditions: AssignmentCondition;
    targetType: 'admin' | 'team' | 'round_robin';
    targetId?: string;
  }) {
    return this.prisma.assignmentRule.create({
      data: {
        name: data.name,
        priority: data.priority || 0,
        conditions: JSON.parse(JSON.stringify(data.conditions)),
        targetType: data.targetType,
        targetId: data.targetId,
      },
    });
  }

  /**
   * 割り当てルール一覧を取得
   */
  async getRules() {
    return this.prisma.assignmentRule.findMany({
      orderBy: { priority: 'desc' },
    });
  }

  /**
   * 割り当てルールを更新
   */
  async updateRule(id: string, data: Partial<{
    name: string;
    priority: number;
    conditions: AssignmentCondition;
    targetType: string;
    targetId: string;
    isEnabled: boolean;
  }>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
    if (data.targetType !== undefined) updateData.targetType = data.targetType;
    if (data.targetId !== undefined) updateData.targetId = data.targetId;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    return this.prisma.assignmentRule.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 割り当てルールを削除
   */
  async deleteRule(id: string) {
    return this.prisma.assignmentRule.delete({
      where: { id },
    });
  }

  /**
   * 会話に最適なオペレーターを自動割り当て
   */
  async assignConversation(conversationId: string): Promise<string | null> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { take: 5, orderBy: { createdAt: 'desc' } } },
    });

    if (!conversation) {
      this.logger.warn(`Conversation not found: ${conversationId}`);
      return null;
    }

    // 有効なルールを優先度順に取得
    const rules = await this.prisma.assignmentRule.findMany({
      where: { isEnabled: true },
      orderBy: { priority: 'desc' },
    });

    for (const rule of rules) {
      const conditions = rule.conditions as unknown as AssignmentCondition;

      // 条件をチェック
      if (!this.matchConditions(conversation, conditions)) {
        continue;
      }

      // ターゲットタイプに応じてオペレーターを選択
      const adminId = await this.selectAdmin(rule.targetType, rule.targetId, conditions);

      if (adminId) {
        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { assignedAdminId: adminId, status: 'HUMAN' },
        });

        this.logger.log(`Assigned conversation ${conversationId} to admin ${adminId} by rule ${rule.name}`);
        return adminId;
      }
    }

    // ルールにマッチしない場合はデフォルトのラウンドロビン
    const adminId = await this.selectAdminRoundRobin();
    if (adminId) {
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { assignedAdminId: adminId, status: 'HUMAN' },
      });
      this.logger.log(`Assigned conversation ${conversationId} to admin ${adminId} by round-robin`);
    }

    return adminId;
  }

  /**
   * 管理者スキルを設定
   */
  async setAdminSkill(adminId: string, skill: string, level: number) {
    return this.prisma.adminSkill.upsert({
      where: { adminId_skill: { adminId, skill } },
      create: { adminId, skill, level },
      update: { level },
    });
  }

  /**
   * 管理者スキルを取得
   */
  async getAdminSkills(adminId: string) {
    return this.prisma.adminSkill.findMany({
      where: { adminId },
      orderBy: { skill: 'asc' },
    });
  }

  /**
   * 管理者スキルを削除
   */
  async removeAdminSkill(adminId: string, skill: string) {
    return this.prisma.adminSkill.delete({
      where: { adminId_skill: { adminId, skill } },
    });
  }

  /**
   * スキル別の管理者一覧
   */
  async getAdminsBySkill(skill: string, minLevel = 1) {
    return this.prisma.adminSkill.findMany({
      where: {
        skill,
        level: { gte: minLevel },
      },
      orderBy: { level: 'desc' },
    });
  }

  /**
   * 利用可能なオペレーター一覧（割り当て候補）
   */
  async getAvailableAdmins() {
    return this.prisma.admin.findMany({
      where: {
        status: 'ONLINE',
        isLocked: false,
      },
      include: {
        _count: {
          select: {
            conversations: {
              where: { status: { in: ['HUMAN', 'WAITING'] } },
            },
          },
        },
      },
    });
  }

  // ===== プライベートメソッド =====

  private matchConditions(
    conversation: { channel: string; metadata: Prisma.JsonValue; messages: { content: string }[] },
    conditions: AssignmentCondition,
  ): boolean {
    // チャネル条件
    if (conditions.channels && conditions.channels.length > 0) {
      if (!conditions.channels.includes(conversation.channel)) {
        return false;
      }
    }

    // キーワード条件
    if (conditions.keywords && conditions.keywords.length > 0) {
      const messageText = conversation.messages.map((m) => m.content).join(' ').toLowerCase();
      const hasKeyword = conditions.keywords.some((kw) => messageText.includes(kw.toLowerCase()));
      if (!hasKeyword) {
        return false;
      }
    }

    // 時間帯条件
    if (conditions.timeSlots && conditions.timeSlots.length > 0) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const inTimeSlot = conditions.timeSlots.some(
        (slot) => currentTime >= slot.start && currentTime <= slot.end,
      );
      if (!inTimeSlot) {
        return false;
      }
    }

    return true;
  }

  private async selectAdmin(
    targetType: string,
    targetId: string | null,
    conditions: AssignmentCondition,
  ): Promise<string | null> {
    switch (targetType) {
      case 'admin':
        // 特定の管理者
        if (targetId) {
          const admin = await this.prisma.admin.findFirst({
            where: {
              id: targetId,
              status: 'ONLINE',
              isLocked: false,
            },
          });
          return admin?.id || null;
        }
        return null;

      case 'round_robin':
        // スキルを持つ管理者からラウンドロビン
        if (conditions.skills && conditions.skills.length > 0) {
          return this.selectAdminBySkillRoundRobin(conditions.skills);
        }
        return this.selectAdminRoundRobin();

      default:
        return null;
    }
  }

  private async selectAdminRoundRobin(): Promise<string | null> {
    const admins = await this.prisma.admin.findMany({
      where: {
        status: 'ONLINE',
        isLocked: false,
      },
      include: {
        _count: {
          select: {
            conversations: {
              where: { status: { in: ['HUMAN', 'WAITING'] } },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // 同時対応上限に達していない管理者をフィルタ
    const available = admins.filter((a) => a._count.conversations < a.maxConcurrent);

    if (available.length === 0) return null;

    // ラウンドロビンで選択
    this.roundRobinIndex = this.roundRobinIndex % available.length;
    const selected = available[this.roundRobinIndex];
    this.roundRobinIndex++;

    return selected.id;
  }

  private async selectAdminBySkillRoundRobin(skills: string[]): Promise<string | null> {
    // 必要なスキルを持つ管理者を取得
    const skillAdmins = await this.prisma.adminSkill.findMany({
      where: {
        skill: { in: skills },
      },
      select: { adminId: true },
    });

    const adminIds = [...new Set(skillAdmins.map((s) => s.adminId))];

    if (adminIds.length === 0) return null;

    const admins = await this.prisma.admin.findMany({
      where: {
        id: { in: adminIds },
        status: 'ONLINE',
        isLocked: false,
      },
      include: {
        _count: {
          select: {
            conversations: {
              where: { status: { in: ['HUMAN', 'WAITING'] } },
            },
          },
        },
      },
    });

    const available = admins.filter((a) => a._count.conversations < a.maxConcurrent);

    if (available.length === 0) return null;

    // 対応数が最も少ない管理者を選択
    available.sort((a, b) => a._count.conversations - b._count.conversations);
    return available[0].id;
  }
}
