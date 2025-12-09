import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface SegmentCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'not_in';
  value: unknown;
}

export interface SegmentConditions {
  conditions: SegmentCondition[];
  logic: 'and' | 'or';
}

export interface CreateSegmentData {
  name: string;
  description?: string;
  conditions?: SegmentConditions;
  isAutomatic?: boolean;
}

@Injectable()
export class SegmentService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== セグメント管理 =====

  async createSegment(data: CreateSegmentData) {
    return this.prisma.userSegment.create({
      data: {
        name: data.name,
        description: data.description,
        conditions: (data.conditions || { conditions: [], logic: 'and' }) as Prisma.InputJsonValue,
        isAutomatic: data.isAutomatic ?? true,
      },
    });
  }

  async getSegments() {
    return this.prisma.userSegment.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getSegment(id: string) {
    const segment = await this.prisma.userSegment.findUnique({
      where: { id },
    });
    if (!segment) {
      throw new NotFoundException('Segment not found');
    }
    return segment;
  }

  async updateSegment(id: string, data: Partial<CreateSegmentData>) {
    const updateData: Prisma.UserSegmentUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.conditions !== undefined) updateData.conditions = data.conditions as unknown as Prisma.InputJsonValue;
    if (data.isAutomatic !== undefined) updateData.isAutomatic = data.isAutomatic;

    return this.prisma.userSegment.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteSegment(id: string) {
    return this.prisma.$transaction([
      this.prisma.userSegmentMembership.deleteMany({ where: { segmentId: id } }),
      this.prisma.userSegment.delete({ where: { id } }),
    ]);
  }

  // ===== メンバーシップ管理 =====

  // 静的セグメントにユーザーを追加
  async addMember(segmentId: string, userId: string) {
    const segment = await this.getSegment(segmentId);
    if (segment.isAutomatic) {
      throw new BadRequestException('Cannot manually add members to automatic segments');
    }

    return this.prisma.userSegmentMembership.upsert({
      where: {
        segmentId_userId: { segmentId, userId },
      },
      update: {},
      create: { segmentId, userId },
    });
  }

  // 複数ユーザーを追加
  async addMembers(segmentId: string, userIds: string[]) {
    const segment = await this.getSegment(segmentId);
    if (segment.isAutomatic) {
      throw new BadRequestException('Cannot manually add members to automatic segments');
    }

    const data = userIds.map((userId) => ({
      segmentId,
      userId,
    }));

    return this.prisma.userSegmentMembership.createMany({
      data,
      skipDuplicates: true,
    });
  }

  // メンバーを削除
  async removeMember(segmentId: string, userId: string) {
    return this.prisma.userSegmentMembership.delete({
      where: {
        segmentId_userId: { segmentId, userId },
      },
    });
  }

  // セグメントのメンバー一覧
  async getMembers(segmentId: string, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      this.prisma.userSegmentMembership.findMany({
        where: { segmentId },
        skip,
        take: limit,
        orderBy: { addedAt: 'desc' },
      }),
      this.prisma.userSegmentMembership.count({ where: { segmentId } }),
    ]);

    return {
      members: members.map((m) => ({ userId: m.userId, addedAt: m.addedAt })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ユーザーが所属するセグメント一覧
  async getUserSegments(userId: string) {
    const memberships = await this.prisma.userSegmentMembership.findMany({
      where: { userId },
    });

    const segmentIds = memberships.map((m) => m.segmentId);
    return this.prisma.userSegment.findMany({
      where: { id: { in: segmentIds } },
    });
  }

  // ===== 動的セグメント評価 =====

  // 動的セグメントのメンバーを再計算
  async evaluateSegment(segmentId: string) {
    const segment = await this.getSegment(segmentId);
    if (!segment.isAutomatic) {
      throw new BadRequestException('Segment is not automatic');
    }

    const conditions = segment.conditions as unknown as SegmentConditions;
    if (!conditions || !conditions.conditions || conditions.conditions.length === 0) {
      return { updated: 0 };
    }

    // ルールに基づいてユーザーを検索
    const matchingUsers = await this.findUsersByConditions(conditions);

    // 既存のメンバーシップをクリア
    await this.prisma.userSegmentMembership.deleteMany({
      where: { segmentId },
    });

    // 新しいメンバーシップを作成
    if (matchingUsers.length > 0) {
      await this.prisma.userSegmentMembership.createMany({
        data: matchingUsers.map((u) => ({
          segmentId,
          userId: u.id,
        })),
      });
    }

    // ユーザー数を更新
    await this.prisma.userSegment.update({
      where: { id: segmentId },
      data: {
        userCount: matchingUsers.length,
        lastUpdatedAt: new Date(),
      },
    });

    return { updated: matchingUsers.length };
  }

  // 全ての動的セグメントを再計算
  async evaluateAllSegments() {
    const automaticSegments = await this.prisma.userSegment.findMany({
      where: { isAutomatic: true },
    });

    const results = await Promise.all(
      automaticSegments.map(async (segment) => {
        const result = await this.evaluateSegment(segment.id);
        return { segmentId: segment.id, name: segment.name, ...result };
      })
    );

    return results;
  }

  // 条件に基づいてユーザーを検索
  private async findUsersByConditions(conditions: SegmentConditions) {
    const where: Prisma.UserWhereInput = {};
    const prismaConditions: Prisma.UserWhereInput[] = [];

    for (const condition of conditions.conditions) {
      const prismaCondition = this.buildPrismaCondition(condition);
      if (prismaCondition) {
        prismaConditions.push(prismaCondition);
      }
    }

    if (prismaConditions.length > 0) {
      if (conditions.logic === 'and') {
        where.AND = prismaConditions;
      } else {
        where.OR = prismaConditions;
      }
    }

    return this.prisma.user.findMany({
      where,
      select: { id: true },
    });
  }

  private buildPrismaCondition(condition: SegmentCondition): Prisma.UserWhereInput | null {
    const { field, operator, value } = condition;

    switch (field) {
      case 'name':
      case 'email':
      case 'company':
        return this.buildStringCondition(field, operator, value as string);
      case 'createdAt':
      case 'updatedAt':
        return this.buildDateCondition(field, operator, value as string);
      default:
        return null;
    }
  }

  private buildStringCondition(
    field: string,
    operator: string,
    value: string,
  ): Prisma.UserWhereInput {
    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'ne':
        return { [field]: { not: value } };
      case 'contains':
        return { [field]: { contains: value, mode: 'insensitive' } };
      default:
        return { [field]: value };
    }
  }

  private buildDateCondition(
    field: string,
    operator: string,
    value: string,
  ): Prisma.UserWhereInput {
    const date = new Date(value);
    switch (operator) {
      case 'gt':
        return { [field]: { gt: date } };
      case 'gte':
        return { [field]: { gte: date } };
      case 'lt':
        return { [field]: { lt: date } };
      case 'lte':
        return { [field]: { lte: date } };
      default:
        return { [field]: date };
    }
  }

  // ===== 統計 =====

  async getSegmentStats() {
    const segments = await this.prisma.userSegment.findMany();
    const totalUsers = await this.prisma.user.count();

    return {
      totalSegments: segments.length,
      automaticSegments: segments.filter((s) => s.isAutomatic).length,
      manualSegments: segments.filter((s) => !s.isAutomatic).length,
      segmentCoverage: segments.map((s) => ({
        id: s.id,
        name: s.name,
        userCount: s.userCount,
        percentage: totalUsers > 0 ? Math.round((s.userCount / totalUsers) * 100) : 0,
      })),
    };
  }
}
