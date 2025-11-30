import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGES } from '@crossbot/shared';

interface ScenarioOption {
  nodeId: number;
  label: string;
}

interface ScenarioResponse {
  message: string;
  options: ScenarioOption[];
  action?: string;
  actionValue?: string;
}

@Injectable()
export class ScenarioService {
  constructor(private prisma: PrismaService) {}

  /**
   * ルートノードの選択肢を取得（チャット開始時）
   */
  async getInitialOptions(): Promise<ScenarioResponse> {
    const rootChildren = await this.prisma.scenarioNode.findMany({
      where: { parentId: null, level: 1, isActive: true },
      orderBy: { order: 'asc' },
    });

    // ルートノードがない場合は初期メッセージのみ返す
    if (rootChildren.length === 0) {
      return {
        message: MESSAGES.SYSTEM.WELCOME,
        options: [],
      };
    }

    return {
      message: MESSAGES.SYSTEM.WELCOME,
      options: rootChildren.map((node) => ({
        nodeId: node.id,
        label: node.triggerText,
      })),
    };
  }

  /**
   * 選択肢クリック時の処理
   */
  async processSelection(conversationId: string, nodeId: number): Promise<ScenarioResponse> {
    // 特殊ケース：はじめに戻る
    if (nodeId === -1) {
      return this.getInitialOptions();
    }

    const node = await this.prisma.scenarioNode.findUnique({
      where: { id: nodeId },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!node) {
      throw new NotFoundException('シナリオノードが見つかりません');
    }

    // アクションの処理
    if (node.action === 'HANDOVER') {
      return {
        message: MESSAGES.SYSTEM.HANDOVER_REQUEST_JP_ONLY,
        options: [],
        action: 'HANDOVER',
      };
    }

    if (node.action === 'RESTART') {
      return this.getInitialOptions();
    }

    // 子ノードがある場合は選択肢を提示
    if (node.children.length > 0) {
      return {
        message: node.responseText || '',
        options: node.children.map((child) => ({
          nodeId: child.id,
          label: child.triggerText,
        })),
        action: node.action || undefined,
        actionValue: node.actionValue || undefined,
      };
    }

    // 末端ノード（子がない）の場合
    return {
      message: node.responseText || MESSAGES.SYSTEM.CLOSED,
      options: [{ nodeId: -1, label: 'はじめに戻る' }],
      action: node.action || undefined,
      actionValue: node.actionValue || undefined,
    };
  }

  /**
   * シナリオツリー全体を取得
   */
  async getFullTree() {
    const nodes = await this.prisma.scenarioNode.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });

    // ツリー構造に変換
    const nodeMap = new Map<number, typeof nodes[0] & { children: typeof nodes }>();
    const rootNodes: (typeof nodes[0] & { children: typeof nodes })[] = [];

    nodes.forEach((node) => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    nodes.forEach((node) => {
      const current = nodeMap.get(node.id)!;
      if (node.parentId === null) {
        rootNodes.push(current);
      } else {
        const parent = nodeMap.get(node.parentId);
        if (parent) {
          parent.children.push(current);
        }
      }
    });

    return rootNodes;
  }

  /**
   * 特定ノードの子ノードを取得
   */
  async getChildren(nodeId: number) {
    return this.prisma.scenarioNode.findMany({
      where: { parentId: nodeId, isActive: true },
      orderBy: { order: 'asc' },
    });
  }

  /**
   * ノードを作成
   */
  async createNode(data: {
    parentId?: number;
    level: number;
    triggerText: string;
    responseText?: string;
    action?: string;
    actionValue?: string;
    order?: number;
  }) {
    return this.prisma.scenarioNode.create({
      data: {
        parentId: data.parentId,
        level: data.level,
        triggerText: data.triggerText,
        responseText: data.responseText,
        action: data.action as any,
        actionValue: data.actionValue,
        order: data.order || 0,
      },
    });
  }

  /**
   * ノードを更新
   */
  async updateNode(
    nodeId: number,
    data: {
      triggerText?: string;
      responseText?: string;
      action?: string;
      actionValue?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.scenarioNode.update({
      where: { id: nodeId },
      data: {
        triggerText: data.triggerText,
        responseText: data.responseText,
        action: data.action as any,
        actionValue: data.actionValue,
        order: data.order,
        isActive: data.isActive,
      },
    });
  }

  /**
   * ノードを削除（非アクティブ化）
   */
  async deleteNode(nodeId: number) {
    return this.prisma.scenarioNode.update({
      where: { id: nodeId },
      data: { isActive: false },
    });
  }

  /**
   * 全ノードを削除（インポート前のクリア用）
   */
  async clearAll() {
    await this.prisma.scenarioNode.deleteMany({});
  }
}
