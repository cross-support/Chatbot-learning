import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type TestStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface VariantData {
  name: string;
  weight: number; // 0-100の割合
  content?: Record<string, unknown>;
}

export interface CreateTestData {
  name: string;
  description?: string;
  nodeId?: number;
  variants: VariantData[];
}

@Injectable()
export class AbTestService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== テスト管理 =====

  async createTest(data: CreateTestData) {
    // バリアントの重みが100%になるか確認
    const totalWeight = data.variants.reduce((sum, v) => sum + v.weight, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException('Variant weights must sum to 100');
    }

    // トランザクションでテストとバリアントを作成
    return this.prisma.$transaction(async (tx) => {
      const test = await tx.abTest.create({
        data: {
          name: data.name,
          description: data.description,
          nodeId: data.nodeId,
          status: 'draft',
        },
      });

      const variants = await Promise.all(
        data.variants.map((variant) =>
          tx.abTestVariant.create({
            data: {
              testId: test.id,
              name: variant.name,
              weight: variant.weight,
              content: (variant.content || {}) as Prisma.InputJsonValue,
            },
          })
        )
      );

      return { ...test, variants };
    });
  }

  async getTests(status?: TestStatus) {
    return this.prisma.abTest.findMany({
      where: status ? { status } : undefined,
      include: {
        variants: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTest(id: string) {
    const test = await this.prisma.abTest.findUnique({
      where: { id },
      include: {
        variants: true,
      },
    });
    if (!test) {
      throw new NotFoundException('A/B test not found');
    }
    return test;
  }

  async updateTest(id: string, data: Partial<CreateTestData>) {
    const test = await this.getTest(id);
    if (test.status === 'running') {
      throw new BadRequestException('Cannot update a running test');
    }

    const updateData: Prisma.AbTestUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.nodeId !== undefined) updateData.nodeId = data.nodeId;

    return this.prisma.abTest.update({
      where: { id },
      data: updateData,
      include: { variants: true },
    });
  }

  async deleteTest(id: string) {
    const test = await this.getTest(id);
    if (test.status === 'running') {
      throw new BadRequestException('Cannot delete a running test');
    }

    return this.prisma.$transaction([
      this.prisma.abTestAssignment.deleteMany({ where: { testId: id } }),
      this.prisma.abTestVariant.deleteMany({ where: { testId: id } }),
      this.prisma.abTest.delete({ where: { id } }),
    ]);
  }

  // ===== テスト状態管理 =====

  async startTest(id: string) {
    const test = await this.getTest(id);
    if (test.status !== 'draft' && test.status !== 'paused') {
      throw new BadRequestException('Test must be in draft or paused status to start');
    }

    return this.prisma.abTest.update({
      where: { id },
      data: {
        status: 'running',
        startedAt: test.startedAt || new Date(),
      },
    });
  }

  async pauseTest(id: string) {
    const test = await this.getTest(id);
    if (test.status !== 'running') {
      throw new BadRequestException('Test must be running to pause');
    }

    return this.prisma.abTest.update({
      where: { id },
      data: { status: 'paused' },
    });
  }

  async completeTest(id: string) {
    return this.prisma.abTest.update({
      where: { id },
      data: {
        status: 'completed',
        endedAt: new Date(),
      },
    });
  }

  // ===== バリアント割り当て =====

  // ユーザーにバリアントを割り当て
  async assignVariant(testId: string, userId: string) {
    const test = await this.getTest(testId);
    if (test.status !== 'running') {
      return null;
    }

    // 既存の割り当てを確認
    const existing = await this.prisma.abTestAssignment.findUnique({
      where: {
        testId_userId: { testId, userId },
      },
    });

    if (existing) {
      const variant = test.variants.find(v => v.id === existing.variantId);
      return variant || null;
    }

    // 重み付きランダム選択
    const selectedVariant = this.selectVariantByWeight(test.variants);

    // 割り当てを記録
    await this.prisma.abTestAssignment.create({
      data: {
        testId,
        variantId: selectedVariant.id,
        userId,
      },
    });

    // バリアントのインプレッション数を更新
    await this.prisma.abTestVariant.update({
      where: { id: selectedVariant.id },
      data: { impressions: { increment: 1 } },
    });

    return selectedVariant;
  }

  // 特定のユーザーの全テスト割り当てを取得
  async getUserAssignments(userId: string) {
    return this.prisma.abTestAssignment.findMany({
      where: { userId },
    });
  }

  // ===== コンバージョン記録 =====

  async recordConversion(testId: string, userId: string) {
    const assignment = await this.prisma.abTestAssignment.findUnique({
      where: {
        testId_userId: { testId, userId },
      },
    });

    if (!assignment) {
      return null; // 割り当てがない
    }

    if (assignment.converted) {
      return assignment; // 既にコンバージョン済み
    }

    // 割り当てを更新
    const updated = await this.prisma.abTestAssignment.update({
      where: { id: assignment.id },
      data: {
        converted: true,
        convertedAt: new Date(),
      },
    });

    // バリアントのコンバージョン数を更新
    await this.prisma.abTestVariant.update({
      where: { id: assignment.variantId },
      data: { conversions: { increment: 1 } },
    });

    return updated;
  }

  // ===== 結果分析 =====

  async getTestResults(testId: string) {
    const test = await this.getTest(testId);

    const variantResults = test.variants.map((variant) => {
      const conversionRate =
        variant.impressions > 0
          ? (variant.conversions / variant.impressions) * 100
          : 0;

      return {
        variantId: variant.id,
        variantName: variant.name,
        weight: variant.weight,
        impressions: variant.impressions,
        conversions: variant.conversions,
        conversionRate: Math.round(conversionRate * 100) / 100,
      };
    });

    // 統計的有意性の簡易計算
    const controlVariant = variantResults[0];
    const treatmentResults = variantResults.slice(1).map((treatment) => {
      const lift =
        controlVariant.conversionRate > 0
          ? ((treatment.conversionRate - controlVariant.conversionRate) /
              controlVariant.conversionRate) *
            100
          : 0;

      return {
        ...treatment,
        lift: Math.round(lift * 100) / 100,
      };
    });

    return {
      test: {
        id: test.id,
        name: test.name,
        status: test.status,
        startedAt: test.startedAt,
        endedAt: test.endedAt,
      },
      control: controlVariant,
      treatments: treatmentResults,
      totalParticipants: variantResults.reduce((sum, v) => sum + v.impressions, 0),
    };
  }

  // ===== ヘルパー =====

  private selectVariantByWeight(variants: Array<{ id: string; weight: number }>) {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const variant of variants) {
      cumulative += variant.weight;
      if (random < cumulative) {
        return variant;
      }
    }

    // フォールバック
    return variants[variants.length - 1];
  }

  // テスト統計サマリー
  async getTestsSummary() {
    const [draft, running, paused, completed] = await Promise.all([
      this.prisma.abTest.count({ where: { status: 'draft' } }),
      this.prisma.abTest.count({ where: { status: 'running' } }),
      this.prisma.abTest.count({ where: { status: 'paused' } }),
      this.prisma.abTest.count({ where: { status: 'completed' } }),
    ]);

    const totalAssignments = await this.prisma.abTestAssignment.count();
    const totalConversions = await this.prisma.abTestAssignment.count({
      where: { converted: true },
    });

    return {
      testsByStatus: { draft, running, paused, completed },
      totalParticipants: totalAssignments,
      totalConversions,
      overallConversionRate:
        totalAssignments > 0 ? Math.round((totalConversions / totalAssignments) * 10000) / 100 : 0,
    };
  }
}
