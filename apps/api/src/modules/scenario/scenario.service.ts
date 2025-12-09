import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MESSAGES } from '@crossbot/shared';
import { ScenarioAction } from '@prisma/client';

// ==================== レスポンス型定義 ====================

export interface ScenarioOption {
  nodeId: number;
  label: string;
  type?: 'go_to' | 'button' | 'link';
  linkTarget?: string;
}

export interface ScenarioMessage {
  text: string;
  type: 'web_text' | 'web_form';
  formName?: string;
}

export interface ScenarioResponse {
  messages: ScenarioMessage[];
  options: ScenarioOption[];
  action?: ScenarioAction;
  actionValue?: string;
  actionConfig?: Record<string, unknown>;
  nodeName?: string;
}

// 旧形式との互換性用（type/linkTargetも含む）
export interface LegacyScenarioResponse {
  message: string;
  options: ScenarioOption[];
  action?: string;
  actionValue?: string;
}

// ==================== 内部型定義 ====================

interface ResponseAdvanced {
  text: string;
  type: 'web_text' | 'web_form';
  formName?: string;
  replies?: ResponseReply[];
}

interface ResponseReply {
  id?: string;
  label: string;
  value: string;
  type: 'go_to' | 'button' | 'link';
  linkTarget?: string;
}

// ==================== サービス ====================

@Injectable()
export class ScenarioService {
  constructor(private prisma: PrismaService) {}

  /**
   * ルートノードの選択肢を取得（チャット開始時）
   * userRoleに応じて適切なシナリオをフィルタリング
   * scenarioIdを指定した場合はそのシナリオを使用
   */
  async getInitialOptions(userRole?: 'learner' | 'group_admin' | 'global_admin' | string, scenarioId?: string): Promise<ScenarioResponse> {
    // シナリオが指定されていない場合、ユーザーロールに応じたシナリオを検索
    let targetScenarioId = scenarioId;
    if (!targetScenarioId) {
      // ユーザーロールに応じたシナリオを探す
      // 1. まず特定のロール向けシナリオを検索
      // 2. 見つからない場合はtargetRole=null（全員対象）のシナリオを検索
      const roleScenario = await this.prisma.scenario.findFirst({
        where: {
          isActive: true,
          targetRole: userRole || 'learner',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (roleScenario) {
        targetScenarioId = roleScenario.id;
      } else {
        // ロール指定のシナリオがない場合は全員対象のシナリオを検索
        const generalScenario = await this.prisma.scenario.findFirst({
          where: {
            isActive: true,
            targetRole: null,
          },
          orderBy: { createdAt: 'desc' },
        });

        if (generalScenario) {
          targetScenarioId = generalScenario.id;
        } else {
          // フォールバック: 最初のアクティブなシナリオを使用
          const firstScenario = await this.prisma.scenario.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
          });
          targetScenarioId = firstScenario?.id;
        }
      }
    }

    // ルートノードを取得（level=0, parentId=null がルート）
    const rootNode = await this.prisma.scenarioNode.findFirst({
      where: {
        scenarioId: targetScenarioId,
        parentId: null,
        level: 0,
        isActive: true,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!rootNode) {
      // ルートノードがない場合（レガシー形式）
      const legacyRootChildren = await this.prisma.scenarioNode.findMany({
        where: { parentId: null, level: 1, isActive: true, scenarioId: null },
        orderBy: { order: 'asc' },
      });

      if (legacyRootChildren.length > 0) {
        return {
          messages: [{ text: MESSAGES.SYSTEM.WELCOME, type: 'web_text' }],
          options: legacyRootChildren.map(node => ({
            nodeId: node.id,
            label: node.triggerText,
          })),
        };
      }

      // シナリオがない場合はAIモード用のウェルカムメッセージを返す
      return {
        messages: [{ text: MESSAGES.SYSTEM.WELCOME_AI, type: 'web_text' }],
        options: [],
      };
    }

    // response_advancedがある場合はそれを使用
    const messages = this.extractMessages(rootNode);
    const options = this.extractOptions(rootNode);

    return {
      messages,
      options,
      action: rootNode.action || undefined,
      actionValue: rootNode.actionValue || undefined,
      actionConfig: rootNode.actionConfig as Record<string, unknown> | undefined,
      nodeName: rootNode.nodeName || undefined,
    };
  }

  /**
   * 選択肢クリック時の処理
   */
  async processSelection(
    conversationId: string,
    nodeId: number,
    scenarioId?: string,
  ): Promise<ScenarioResponse> {
    // 特殊ケース：はじめに戻る
    if (nodeId === -1) {
      return this.getInitialOptions(scenarioId);
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
    switch (node.action) {
      case 'RESTART':
        return this.getInitialOptions(node.scenarioId || undefined);

      case 'HANDOVER':
        return {
          messages: [{ text: MESSAGES.SYSTEM.HANDOVER_REQUEST_JP_ONLY, type: 'web_text' }],
          options: [],
          action: 'HANDOVER',
          actionConfig: node.actionConfig as Record<string, unknown> | undefined,
        };

      case 'JUMP':
        // ジャンプ先のノードに遷移
        if (node.actionValue) {
          const jumpNodeId = parseInt(node.actionValue, 10);
          if (!isNaN(jumpNodeId)) {
            // 内部IDで検索
            return this.processSelection(conversationId, jumpNodeId, scenarioId);
          } else {
            // ノード名で検索（フォールバック）
            const targetNode = await this.prisma.scenarioNode.findFirst({
              where: {
                scenarioId: node.scenarioId || undefined,
                nodeName: node.actionValue,
                isActive: true,
              },
            });
            if (targetNode) {
              return this.processSelection(conversationId, targetNode.id, scenarioId);
            }
          }
        }
        break;

      case 'LINK':
        // 外部リンク（クライアント側で処理）
        return {
          messages: this.extractMessages(node),
          options: this.extractOptions(node),
          action: 'LINK',
          actionValue: node.actionValue || undefined,
          actionConfig: node.actionConfig as Record<string, unknown> | undefined,
          nodeName: node.nodeName || undefined,
        };

      case 'FORM':
        // フォーム表示
        return {
          messages: this.extractMessages(node),
          options: this.extractOptions(node),
          action: 'FORM',
          actionValue: node.actionValue || undefined,
          actionConfig: node.actionConfig as Record<string, unknown> | undefined,
          nodeName: node.nodeName || undefined,
        };

      case 'MAIL':
        // メール送信（クライアント側で処理後、次のノードへ遷移）
        const mailConfig = node.actionConfig as Record<string, unknown> | undefined;
        return {
          messages: this.extractMessages(node),
          options: this.extractOptions(node),
          action: 'MAIL',
          actionConfig: mailConfig,
          nodeName: node.nodeName || undefined,
        };

      case 'CSV':
        // CSV出力（クライアント側で処理後、次のノードへ遷移）
        const csvConfig = node.actionConfig as Record<string, unknown> | undefined;
        return {
          messages: this.extractMessages(node),
          options: this.extractOptions(node),
          action: 'CSV',
          actionConfig: csvConfig,
          nodeName: node.nodeName || undefined,
        };

      case 'DROP_OFF':
        // 離脱ポイント（統計記録用）
        // 離脱イベントをログに記録
        await this.recordDropOff(conversationId, node.id, node.nodeName || undefined);
        return {
          messages: this.extractMessages(node),
          options: [], // 離脱なので選択肢なし
          action: 'DROP_OFF',
          actionValue: node.actionValue || undefined,
          actionConfig: node.actionConfig as Record<string, unknown> | undefined,
          nodeName: node.nodeName || undefined,
        };
    }

    // メッセージと選択肢を抽出
    const messages = this.extractMessages(node);
    const options = this.extractOptions(node);

    // 子ノードがなく選択肢もない場合は「はじめに戻る」を追加
    if (options.length === 0) {
      options.push({ nodeId: -1, label: 'はじめに戻る', type: 'go_to' });
    }

    return {
      messages,
      options,
      action: node.action || undefined,
      actionValue: node.actionValue || undefined,
      actionConfig: node.actionConfig as Record<string, unknown> | undefined,
      nodeName: node.nodeName || undefined,
    };
  }

  /**
   * ノードからメッセージを抽出
   */
  private extractMessages(node: {
    responseText?: string | null;
    responseAdvanced?: unknown;
  }): ScenarioMessage[] {
    const messages: ScenarioMessage[] = [];

    // responseAdvancedがある場合
    if (node.responseAdvanced && Array.isArray(node.responseAdvanced)) {
      const advanced = node.responseAdvanced as ResponseAdvanced[];
      for (const adv of advanced) {
        messages.push({
          text: adv.text || '',
          type: adv.type || 'web_text',
          formName: adv.formName,
        });
      }
    }

    // responseAdvancedがない場合はresponseTextを使用
    if (messages.length === 0 && node.responseText) {
      messages.push({
        text: node.responseText,
        type: 'web_text',
      });
    }

    return messages;
  }

  /**
   * ノードから選択肢を抽出
   */
  private extractOptions(node: {
    responseAdvanced?: unknown;
    children?: Array<{
      id: number;
      triggerText: string;
      action?: ScenarioAction | null;
      actionValue?: string | null;
    }>;
  }): ScenarioOption[] {
    const options: ScenarioOption[] = [];

    // responseAdvanced内のrepliesから選択肢を抽出
    if (node.responseAdvanced && Array.isArray(node.responseAdvanced)) {
      const advanced = node.responseAdvanced as ResponseAdvanced[];
      for (const adv of advanced) {
        if (adv.replies && Array.isArray(adv.replies)) {
          for (const reply of adv.replies) {
            // replyのidが存在する場合、そのIDを持つ子ノードを探す
            let childNode = node.children?.find(
              c => c.triggerText === reply.value || c.triggerText === reply.label
            );

            if (childNode) {
              options.push({
                nodeId: childNode.id,
                label: reply.label || reply.value,
                type: reply.type,
                linkTarget: reply.linkTarget,
              });
            } else {
              // 子ノードが見つからない場合、ダミーのオプションを作成
              options.push({
                nodeId: -2, // 特殊ID（未解決の選択肢）
                label: reply.label || reply.value,
                type: reply.type,
                linkTarget: reply.linkTarget,
              });
            }
          }
        }
      }
    }

    // responseAdvancedにrepliesがない場合は子ノードを使用
    if (options.length === 0 && node.children && node.children.length > 0) {
      for (const child of node.children) {
        let optionType: 'go_to' | 'button' | 'link' = 'go_to';
        let linkTarget: string | undefined;

        // アクションに応じてタイプを設定
        if (child.action === 'HANDOVER') {
          optionType = 'button';
        } else if (child.action === 'LINK') {
          optionType = 'link';
          linkTarget = child.actionValue || undefined;
        }

        options.push({
          nodeId: child.id,
          label: child.triggerText,
          type: optionType,
          linkTarget,
        });
      }
    }

    return options;
  }

  /**
   * externalIdからノードを検索
   */
  async findNodeByExternalId(
    externalId: string,
    scenarioId?: string,
  ): Promise<number | null> {
    const node = await this.prisma.scenarioNode.findFirst({
      where: {
        externalId,
        scenarioId: scenarioId || undefined,
        isActive: true,
      },
    });
    return node?.id || null;
  }

  /**
   * シナリオツリー全体を取得
   */
  async getFullTree(scenarioId?: string) {
    const nodes = await this.prisma.scenarioNode.findMany({
      where: {
        isActive: true,
        scenarioId: scenarioId || undefined,
      },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });

    // ツリー構造に変換
    type NodeWithChildren = (typeof nodes)[0] & { children: NodeWithChildren[] };
    const nodeMap = new Map<number, NodeWithChildren>();
    const rootNodes: NodeWithChildren[] = [];

    nodes.forEach(node => {
      nodeMap.set(node.id, { ...node, children: [] });
    });

    nodes.forEach(node => {
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
    scenarioId?: string;
    parentId?: number;
    level: number;
    triggerText: string;
    responseText?: string;
    responseAdvanced?: ResponseAdvanced[];
    action?: string;
    actionValue?: string;
    actionConfig?: Record<string, unknown>;
    nodeName?: string;
    order?: number;
  }) {
    return this.prisma.scenarioNode.create({
      data: {
        scenarioId: data.scenarioId,
        parentId: data.parentId,
        level: data.level,
        triggerText: data.triggerText,
        responseText: data.responseText,
        responseAdvanced: data.responseAdvanced as any,
        action: data.action as ScenarioAction,
        actionValue: data.actionValue,
        actionConfig: data.actionConfig as any,
        nodeName: data.nodeName,
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
      responseAdvanced?: ResponseAdvanced[];
      action?: string;
      actionValue?: string;
      actionConfig?: Record<string, unknown>;
      nodeName?: string;
      order?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.scenarioNode.update({
      where: { id: nodeId },
      data: {
        triggerText: data.triggerText,
        responseText: data.responseText,
        responseAdvanced: data.responseAdvanced as any,
        action: data.action as ScenarioAction,
        actionValue: data.actionValue,
        actionConfig: data.actionConfig as any,
        nodeName: data.nodeName,
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
  async clearAll(scenarioId?: string) {
    if (scenarioId) {
      await this.prisma.scenarioNode.deleteMany({
        where: { scenarioId },
      });
    } else {
      await this.prisma.scenarioNode.deleteMany({
        where: { scenarioId: null },
      });
    }
  }

  /**
   * 離脱ポイントを記録（DROP_OFFアクション用）
   */
  private async recordDropOff(
    conversationId: string,
    nodeId: number,
    nodeName?: string,
  ): Promise<void> {
    try {
      // 会話のメタデータに離脱情報を追加
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (conversation) {
        const existingMetadata = (conversation.metadata || {}) as Record<string, unknown>;
        const dropOffPoints = (existingMetadata.dropOffPoints || []) as Array<{
          nodeId: number;
          nodeName?: string;
          timestamp: string;
        }>;

        dropOffPoints.push({
          nodeId,
          nodeName,
          timestamp: new Date().toISOString(),
        });

        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: {
            metadata: {
              ...existingMetadata,
              dropOffPoints,
              lastDropOff: {
                nodeId,
                nodeName,
                timestamp: new Date().toISOString(),
              },
            },
          },
        });
      }
    } catch (error) {
      // 記録失敗してもシナリオ処理は継続
      console.error('DROP_OFF記録エラー:', error);
    }
  }

  // ==================== レガシー互換メソッド ====================

  /**
   * 旧形式のレスポンスを返す（互換性用）
   */
  async getInitialOptionsLegacy(): Promise<LegacyScenarioResponse> {
    const response = await this.getInitialOptions();
    return this.convertToLegacyResponse(response);
  }

  async processSelectionLegacy(
    conversationId: string,
    nodeId: number,
  ): Promise<LegacyScenarioResponse> {
    const response = await this.processSelection(conversationId, nodeId);
    return this.convertToLegacyResponse(response);
  }

  private convertToLegacyResponse(response: ScenarioResponse): LegacyScenarioResponse {
    // 複数メッセージを1つに結合
    const message = response.messages.map(m => m.text).join('\n\n');

    return {
      message,
      options: response.options.map(opt => ({
        nodeId: opt.nodeId,
        label: opt.label,
        type: opt.type,
        linkTarget: opt.linkTarget,
      })),
      action: response.action,
      actionValue: response.actionValue,
    };
  }
}
