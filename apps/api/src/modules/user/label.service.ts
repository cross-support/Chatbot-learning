import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LabelService {
  constructor(private prisma: PrismaService) {}

  // ラベル管理
  async createLabel(name: string, color?: string) {
    const existing = await this.prisma.userLabel.findUnique({
      where: { name },
    });

    if (existing) {
      throw new BadRequestException('同名のラベルが既に存在します');
    }

    return this.prisma.userLabel.create({
      data: {
        name,
        color: color || '#3B82F6',
      },
    });
  }

  async findAllLabels() {
    return this.prisma.userLabel.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findLabelById(id: string) {
    const label = await this.prisma.userLabel.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!label) {
      throw new NotFoundException('ラベルが見つかりません');
    }

    return label;
  }

  async updateLabel(id: string, data: { name?: string; color?: string }) {
    await this.findLabelById(id); // 存在確認

    if (data.name) {
      const existing = await this.prisma.userLabel.findFirst({
        where: {
          name: data.name,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException('同名のラベルが既に存在します');
      }
    }

    return this.prisma.userLabel.update({
      where: { id },
      data,
    });
  }

  async deleteLabel(id: string) {
    await this.findLabelById(id); // 存在確認
    await this.prisma.userLabel.delete({ where: { id } });
    return { success: true };
  }

  // ユーザーへのラベル付け
  async assignLabelToUser(userId: string, labelId: string) {
    await this.findLabelById(labelId); // ラベル存在確認

    const existing = await this.prisma.userLabelAssignment.findUnique({
      where: {
        userId_labelId: { userId, labelId },
      },
    });

    if (existing) {
      return existing; // 既に割り当て済み
    }

    return this.prisma.userLabelAssignment.create({
      data: { userId, labelId },
      include: {
        label: true,
      },
    });
  }

  async removeLabelFromUser(userId: string, labelId: string) {
    const assignment = await this.prisma.userLabelAssignment.findUnique({
      where: {
        userId_labelId: { userId, labelId },
      },
    });

    if (!assignment) {
      throw new NotFoundException('ラベルの割り当てが見つかりません');
    }

    await this.prisma.userLabelAssignment.delete({
      where: { id: assignment.id },
    });

    return { success: true };
  }

  async getUserLabels(userId: string) {
    const assignments = await this.prisma.userLabelAssignment.findMany({
      where: { userId },
      include: {
        label: true,
      },
    });

    return assignments.map((a) => a.label);
  }

  async setUserLabels(userId: string, labelIds: string[]) {
    // 既存のラベルをすべて削除
    await this.prisma.userLabelAssignment.deleteMany({
      where: { userId },
    });

    // 新しいラベルを割り当て
    if (labelIds.length > 0) {
      await this.prisma.userLabelAssignment.createMany({
        data: labelIds.map((labelId) => ({ userId, labelId })),
        skipDuplicates: true,
      });
    }

    return this.getUserLabels(userId);
  }

  async findUsersByLabel(labelId: string) {
    const assignments = await this.prisma.userLabelAssignment.findMany({
      where: { labelId },
      select: { userId: true },
    });

    return assignments.map((a) => a.userId);
  }
}
