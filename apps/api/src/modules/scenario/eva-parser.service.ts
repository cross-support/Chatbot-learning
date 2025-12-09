import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScenarioAction, Prisma } from '@prisma/client';

// ==================== EVA JSON 型定義 ====================

interface EvaScenarioData {
  cells: EvaCell[];
}

type EvaCell = EvaNode | EvaLink;

interface EvaNode {
  id: string;
  type: 'devs.Model';
  nodeType: string;
  position?: { x: number; y: number };
  z?: number;
  embeds?: string[];
  parent?: string;
  state?: EvaNodeState;
  inPorts?: string[];
  outPorts?: string[];
}

interface EvaNodeState {
  // dialogue.start
  next_node?: string;

  // dialogue.response
  response_id?: string | number;
  response?: string;
  response_text?: string;
  response_advance?: EvaResponseAdvance[];
  replies?: string[];
  reply_decos?: string[];
  memory?: {
    forms?: string[];
    checked?: boolean;
    name?: string;
  };
  node_name?: {
    checked?: boolean;
    name?: string;
  };
  cv_point?: Record<string, unknown>;
  mode?: string;
  is_feedback?: boolean;
  direct_transition?: {
    checked?: boolean;
    action_texts?: string[];
  };

  // dialogue.joint
  condition_type?: string; // 'go_to' | 'button' | 'link' | 'in' | 'out' | 'submit_form' | 'all'
  condition_value?: string;
  condition_link?: string;
  condition_link_target?: string;

  // system.rtchat
  next_node_in?: string;
  next_node_out?: string;

  // system.mail
  to?: string;
  cc?: string;
  bcc?: string;
  title?: string;
  content?: string;

  // system.csv
  file_name?: string;
  csv_items?: EvaCsvItem[];
}

interface EvaResponseAdvance {
  response_text?: string;
  response_type?: 'web_text' | 'web_form';
  form_name?: string;
  replies?: EvaReply[];
}

interface EvaReply {
  id?: string;
  reply_link?: string;
  reply_value?: string;
  reply_type?: 'go_to' | 'button' | 'link';
}

interface EvaCsvItem {
  csv_title: string;
  csv_type: string;
  csv_value?: string;
}

interface EvaLink {
  id: string;
  type: 'devs.Link';
  source: { id: string; port?: string };
  target: { id: string; port?: string };
}

// ==================== パース結果 ====================

interface ParsedScenarioNode {
  externalId: string;
  nodeType: string;
  triggerText: string;
  responseText?: string;
  responseAdvanced?: ResponseAdvanced[];
  action?: ScenarioAction;
  actionValue?: string;
  actionConfig?: Record<string, unknown>;
  nodeName?: string;
  memoryName?: string;
  formFields?: string[];
  order: number;
  embeddedChildIds: string[];
  linkedTargetIds: string[];
  conditionType?: string;
  conditionValue?: string;
  jumpTarget?: string; // ジャンプ先のノード名 (e.g., "START")
}

interface ResponseAdvanced {
  text: string;
  type: 'web_text' | 'web_form';
  formName?: string;
  replies: ResponseReply[];
  childTriggerTexts?: string[]; // 子ノードのtriggerTextリスト（接続先）
}

interface ResponseReply {
  id?: string;
  label: string;
  value: string;
  type: 'go_to' | 'button' | 'link';
  linkTarget?: string; // ジャンプ先のノード名
}

// ==================== サービス ====================

@Injectable()
export class EvaParserService {
  constructor(private prisma: PrismaService) {}

  /**
   * EVA JSON形式をパースしてデータベースにインポート
   */
  async importFromEvaJson(
    jsonContent: string,
    scenarioName: string,
  ): Promise<{ imported: number; errors: string[]; scenarioId: string }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data: EvaScenarioData = JSON.parse(jsonContent);

      if (!data.cells || !Array.isArray(data.cells)) {
        throw new BadRequestException('Invalid EVA JSON format: cells array not found');
      }

      // ノードとリンクを分離
      const nodes = data.cells.filter((cell): cell is EvaNode => cell.type === 'devs.Model');
      const links = data.cells.filter((cell): cell is EvaLink => cell.type === 'devs.Link');

      console.log(`[EVA Parser] Total cells: ${data.cells.length}, Nodes: ${nodes.length}, Links: ${links.length}`);

      // ノードタイプ別にカウント
      const nodeTypeCounts: Record<string, number> = {};
      nodes.forEach(n => {
        nodeTypeCounts[n.nodeType] = (nodeTypeCounts[n.nodeType] || 0) + 1;
      });
      console.log('[EVA Parser] Node types:', nodeTypeCounts);

      // シナリオを作成
      const scenario = await this.prisma.scenario.create({
        data: {
          name: scenarioName,
          sourceType: 'eva',
          sourceData: data as any,
        },
      });

      // リンクマップを構築（source -> target[]）
      const linkMap = this.buildLinkMap(links);

      // 全ノードをパース
      const parsedNodes = this.parseAllNodes(nodes, linkMap);
      console.log(`[EVA Parser] Parsed nodes: ${parsedNodes.size}`);

      // スタートノードを見つける
      const startNode = nodes.find(n => n.nodeType === 'dialogue.start');
      if (!startNode) {
        errors.push('スタートノードが見つかりません');
        return { imported: 0, errors, scenarioId: scenario.id };
      }

      // スタートノードから接続されている最初のノードを取得
      const startNextNodeId = startNode.state?.next_node || linkMap.get(startNode.id)?.[0];
      if (!startNextNodeId) {
        errors.push('スタートノードから接続されているノードがありません');
        return { imported: 0, errors, scenarioId: scenario.id };
      }

      // 外部ID → 内部ID のマッピング
      const externalToInternalId = new Map<string, number>();

      // ノード名 → 内部ID のマッピング（JUMPアクション用）
      const nodeNameToInternalId = new Map<string, number>();

      // 処理済みノードセット（循環参照防止）
      const processedNodes = new Set<string>();

      // ルートノードから再帰的に処理
      await this.processNodeRecursive(
        scenario.id,
        startNextNodeId,
        null, // 親なし
        1,    // レベル1
        parsedNodes,
        linkMap,
        externalToInternalId,
        nodeNameToInternalId,
        processedNodes,
        errors,
      );

      imported = externalToInternalId.size;
      console.log(`[EVA Parser] Imported ${imported} nodes`);

      // JUMPアクションのactionValueとMAIL/CSVのnextNodeを内部IDに更新
      await this.resolveJumpTargets(scenario.id, nodeNameToInternalId, externalToInternalId);

      return { imported, errors, scenarioId: scenario.id };
    } catch (error) {
      console.error('[EVA Parser] Error:', error);
      if (error instanceof SyntaxError) {
        throw new BadRequestException('Invalid JSON format');
      }
      throw error;
    }
  }

  /**
   * リンクマップを構築
   */
  private buildLinkMap(links: EvaLink[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const link of links) {
      const sourceId = link.source.id;
      const targetId = link.target.id;
      if (!map.has(sourceId)) {
        map.set(sourceId, []);
      }
      map.get(sourceId)!.push(targetId);
    }
    return map;
  }

  /**
   * 全ノードをパース
   */
  private parseAllNodes(
    nodes: EvaNode[],
    linkMap: Map<string, string[]>,
  ): Map<string, ParsedScenarioNode> {
    const parsedMap = new Map<string, ParsedScenarioNode>();

    for (const node of nodes) {
      const parsed = this.parseSingleNode(node, linkMap);
      if (parsed) {
        parsedMap.set(node.id, parsed);
      }
    }

    return parsedMap;
  }

  /**
   * 単一ノードをパース
   */
  private parseSingleNode(
    node: EvaNode,
    linkMap: Map<string, string[]>,
  ): ParsedScenarioNode | null {
    const state = node.state || {};

    // スタートノードはスキップ（特別扱い）
    if (node.nodeType === 'dialogue.start') {
      return null;
    }

    let action: ScenarioAction | undefined;
    let actionValue: string | undefined;
    let actionConfig: Record<string, unknown> | undefined;
    let jumpTarget: string | undefined;

    // ノードタイプに応じた処理
    switch (node.nodeType) {
      case 'dialogue.response':
        // フォームを含む場合
        if (state.response_advance?.some(adv => adv.response_type === 'web_form')) {
          action = 'FORM';
          actionConfig = {
            formFields: state.memory?.forms || [],
          };
        }
        break;

      case 'dialogue.joint':
        // 条件分岐ノード - condition_typeに応じた処理
        actionConfig = {
          conditionType: state.condition_type,
          conditionValue: state.condition_value,
          conditionLink: state.condition_link,
          conditionLinkTarget: state.condition_link_target,
        };

        switch (state.condition_type) {
          case 'go_to':
            // 別ノードへ遷移
            if (state.condition_link === 'START' || state.condition_value === 'はじめに戻る') {
              action = 'RESTART';
            } else if (state.condition_link) {
              // ノード名へジャンプ
              action = 'JUMP';
              jumpTarget = state.condition_link;
              actionValue = state.condition_link; // 後で内部IDに解決される
            }
            break;

          case 'button':
            // ボタンアクション（オペレーター接続）
            if (state.condition_value?.includes('オペレーター')) {
              action = 'HANDOVER';
            }
            break;

          case 'link':
            // 外部リンク
            action = 'LINK';
            actionValue = state.condition_link || state.condition_link_target;
            break;

          case 'submit_form':
            // フォーム送信後の処理
            action = 'FORM';
            actionConfig.formSubmit = true;
            break;

          case 'in':
            // RTChat切替成功時の遷移
            actionConfig.rtchatResult = 'success';
            break;

          case 'out':
            // RTChat切替失敗時の遷移
            actionConfig.rtchatResult = 'failure';
            break;

          case 'all':
            // 無条件遷移（常に次へ進む）
            actionConfig.unconditional = true;
            break;
        }
        break;

      case 'system.rtchat':
        action = 'HANDOVER';
        actionConfig = {
          nextNodeIn: state.next_node_in,
          nextNodeOut: state.next_node_out,
        };
        break;

      case 'system.mail':
        action = 'MAIL';
        actionConfig = {
          to: state.to,
          cc: state.cc,
          bcc: state.bcc,
          title: state.title,
          content: state.content,
          nextNode: state.next_node,
        };
        break;

      case 'system.csv':
        action = 'CSV';
        actionConfig = {
          fileName: state.file_name,
          items: state.csv_items,
          nextNode: state.next_node,
        };
        break;

      default:
        // 未知のノードタイプ
        console.log(`[EVA Parser] Unknown node type: ${node.nodeType}`);
        break;
    }

    // 応答テキストの取得
    let responseText = state.response_text || '';

    // response_advance を処理
    const responseAdvanced: ResponseAdvanced[] = [];
    if (state.response_advance && state.response_advance.length > 0) {
      for (const adv of state.response_advance) {
        const replies: ResponseReply[] = [];
        if (adv.replies) {
          for (const r of adv.replies) {
            replies.push({
              id: r.id,
              label: r.reply_link || r.reply_value || '',
              value: r.reply_value || r.reply_link || '',
              type: r.reply_type || 'go_to',
              linkTarget: r.reply_link,
            });
          }
        }
        responseAdvanced.push({
          text: adv.response_text || '',
          type: adv.response_type || 'web_text',
          formName: adv.form_name,
          replies,
        });
      }
    }

    // トリガーテキスト（選択肢ラベル）の決定
    let triggerText = '';
    if (node.nodeType === 'dialogue.joint') {
      triggerText = state.condition_value || 'オプション';
    } else if (node.nodeType === 'dialogue.response') {
      triggerText = state.node_name?.name || state.memory?.name || 'ノード';
    } else {
      triggerText = state.node_name?.name || node.nodeType;
    }

    // 埋め込み子ノード
    const embeddedChildIds = node.embeds || [];

    // リンク先ノード
    const linkedTargetIds = linkMap.get(node.id) || [];
    // state.next_node があればそれも追加
    if (state.next_node && !linkedTargetIds.includes(state.next_node)) {
      linkedTargetIds.push(state.next_node);
    }

    return {
      externalId: node.id,
      nodeType: node.nodeType,
      triggerText,
      responseText,
      responseAdvanced: responseAdvanced.length > 0 ? responseAdvanced : undefined,
      action,
      actionValue,
      actionConfig,
      nodeName: state.node_name?.name,
      memoryName: state.memory?.name,
      formFields: state.memory?.forms,
      order: node.z || 0,
      embeddedChildIds,
      linkedTargetIds,
      conditionType: state.condition_type,
      conditionValue: state.condition_value,
      jumpTarget,
    };
  }

  /**
   * ノードを再帰的に処理してDBに挿入
   */
  private async processNodeRecursive(
    scenarioId: string,
    externalId: string,
    parentId: number | null,
    level: number,
    parsedNodes: Map<string, ParsedScenarioNode>,
    linkMap: Map<string, string[]>,
    externalToInternalId: Map<string, number>,
    nodeNameToInternalId: Map<string, number>,
    processedNodes: Set<string>,
    errors: string[],
  ): Promise<void> {
    // 循環参照防止
    if (processedNodes.has(externalId)) {
      return;
    }
    processedNodes.add(externalId);

    const parsed = parsedNodes.get(externalId);
    if (!parsed) {
      // パースされていないノード（リンクのみの接続等）の場合、リンク先を辿る
      const nextIds = linkMap.get(externalId) || [];
      for (const nextId of nextIds) {
        await this.processNodeRecursive(
          scenarioId,
          nextId,
          parentId,
          level,
          parsedNodes,
          linkMap,
          externalToInternalId,
          nodeNameToInternalId,
          processedNodes,
          errors,
        );
      }
      return;
    }

    try {
      // DBにノードを挿入
      const createdNode = await this.prisma.scenarioNode.create({
        data: {
          scenarioId,
          parentId,
          externalId: parsed.externalId,
          level,
          triggerText: parsed.triggerText,
          responseText: parsed.responseText,
          responseAdvanced: parsed.responseAdvanced as any,
          action: parsed.action,
          actionValue: parsed.actionValue,
          actionConfig: parsed.actionConfig as any,
          nodeName: parsed.nodeName || parsed.memoryName,
          order: parsed.order,
        },
      });

      externalToInternalId.set(externalId, createdNode.id);

      // ノード名をマッピングに追加（JUMPアクション解決用）
      if (parsed.nodeName) {
        nodeNameToInternalId.set(parsed.nodeName, createdNode.id);
      }
      if (parsed.memoryName) {
        nodeNameToInternalId.set(parsed.memoryName, createdNode.id);
      }

      // 埋め込み子ノード（選択肢）を処理
      for (const childId of parsed.embeddedChildIds) {
        await this.processNodeRecursive(
          scenarioId,
          childId,
          createdNode.id,
          level + 1,
          parsedNodes,
          linkMap,
          externalToInternalId,
          nodeNameToInternalId,
          processedNodes,
          errors,
        );
      }

      // リンク先ノードを処理（埋め込みでないもの）
      for (const targetId of parsed.linkedTargetIds) {
        if (!parsed.embeddedChildIds.includes(targetId)) {
          await this.processNodeRecursive(
            scenarioId,
            targetId,
            createdNode.id,
            level + 1,
            parsedNodes,
            linkMap,
            externalToInternalId,
            nodeNameToInternalId,
            processedNodes,
            errors,
          );
        }
      }
    } catch (error) {
      errors.push(`ノード ${externalId} の挿入エラー: ${error}`);
    }
  }

  /**
   * JUMPアクションのターゲットとMAIL/CSVのnextNodeを解決
   */
  private async resolveJumpTargets(
    scenarioId: string,
    nodeNameToInternalId: Map<string, number>,
    externalToInternalId?: Map<string, number>,
  ): Promise<void> {
    // JUMP アクションを持つノードを取得
    const jumpNodes = await this.prisma.scenarioNode.findMany({
      where: {
        scenarioId,
        action: 'JUMP',
      },
    });

    for (const node of jumpNodes) {
      if (node.actionValue) {
        const targetInternalId = nodeNameToInternalId.get(node.actionValue);
        if (targetInternalId) {
          await this.prisma.scenarioNode.update({
            where: { id: node.id },
            data: { actionValue: String(targetInternalId) },
          });
        }
      }
    }

    // MAIL/CSVのnextNodeを解決
    if (externalToInternalId) {
      const actionNodes = await this.prisma.scenarioNode.findMany({
        where: {
          scenarioId,
          action: { in: ['MAIL', 'CSV', 'HANDOVER'] },
        },
      });

      for (const node of actionNodes) {
        const config = node.actionConfig as Record<string, unknown> | null;
        if (config?.nextNode && typeof config.nextNode === 'string') {
          const nextNodeInternalId = externalToInternalId.get(config.nextNode);
          if (nextNodeInternalId) {
            await this.prisma.scenarioNode.update({
              where: { id: node.id },
              data: {
                actionConfig: {
                  ...config,
                  nextNodeId: nextNodeInternalId,
                },
              },
            });
          }
        }
        // RTChat (HANDOVER) の nextNodeIn/Out を解決
        if (config?.nextNodeIn && typeof config.nextNodeIn === 'string') {
          const nextInId = externalToInternalId.get(config.nextNodeIn);
          const nextOutId = config.nextNodeOut && typeof config.nextNodeOut === 'string'
            ? externalToInternalId.get(config.nextNodeOut)
            : undefined;
          await this.prisma.scenarioNode.update({
            where: { id: node.id },
            data: {
              actionConfig: {
                ...config,
                nextNodeInId: nextInId,
                nextNodeOutId: nextOutId,
              },
            },
          });
        }
      }
    }
  }

  /**
   * シナリオ一覧を取得
   */
  async getScenarios() {
    return this.prisma.scenario.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { nodes: true },
        },
      },
    });
  }

  /**
   * シナリオを削除（論理削除）
   */
  async deleteScenario(scenarioId: string) {
    return this.prisma.scenario.update({
      where: { id: scenarioId },
      data: { isActive: false },
    });
  }

  /**
   * シナリオを完全削除（物理削除）
   */
  async deleteScenarioHard(scenarioId: string) {
    // 関連ノードも削除される（onDelete: Cascade）
    return this.prisma.scenario.delete({
      where: { id: scenarioId },
    });
  }

  /**
   * 特定シナリオのノードを取得
   */
  async getScenarioNodes(scenarioId: string) {
    return this.prisma.scenarioNode.findMany({
      where: { scenarioId, isActive: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });
  }

  /**
   * 特定シナリオのツリー構造を取得
   */
  async getScenarioTree(scenarioId: string) {
    const nodes = await this.getScenarioNodes(scenarioId);

    // ツリー構造を構築
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
   * シナリオ詳細（ノード含む）を取得（エディタ用）
   * 新しいエディタ形式（responses配列、branches配列）に変換
   */
  async getScenarioWithNodes(scenarioId: string) {
    const scenario = await this.prisma.scenario.findUnique({
      where: { id: scenarioId },
      include: {
        nodes: {
          where: { isActive: true },
          orderBy: [{ level: 'asc' }, { order: 'asc' }],
        },
      },
    });

    if (!scenario) {
      return null;
    }

    // sourceDataからconnectionsとエディタ用のノードデータを取得
    const sourceData = scenario.sourceData as { nodes?: unknown[]; connections?: unknown[] } | null;
    const editorConnections = sourceData?.connections || [];

    // エディタで作成されたシナリオの場合はsourceDataからノードを復元
    if (scenario.sourceType === 'editor' && sourceData?.nodes && Array.isArray(sourceData.nodes)) {
      return {
        id: scenario.id,
        name: scenario.name,
        targetRole: scenario.targetRole,
        sourceType: scenario.sourceType,
        createdAt: scenario.createdAt,
        nodes: sourceData.nodes,
        connections: editorConnections,
      };
    }

    // インポートされたシナリオの場合はDBノードから新しいエディタ形式に変換
    const editorNodes = scenario.nodes.map((node, index) => {
      const nodeType = node.action ? this.actionToNodeType(node.action) : 'message';
      const position = this.calculateNodePosition(node.level, node.order);

      // responseAdvancedからresponsesとbranchesを構築
      const responseAdvanced = node.responseAdvanced as ResponseAdvanced[] | null;
      const responses = this.convertToEditorResponses(node.responseText, responseAdvanced);
      const branches = this.convertToEditorBranches(responseAdvanced);

      return {
        id: node.externalId || String(node.id),
        type: nodeType,
        position,
        data: {
          label: node.triggerText || nodeType,
          responses,
          branches: branches.length > 0 ? branches : undefined,
          // レガシー互換
          content: node.responseText || '',
        },
        settings: {
          nodeName: node.nodeName || undefined,
          freeInputMode: 'default' as const,
        },
      };
    });

    // ノード間の接続をparentIdから生成
    const connections = this.buildConnectionsFromNodes(scenario.nodes);

    return {
      id: scenario.id,
      name: scenario.name,
      targetRole: scenario.targetRole,
      sourceType: scenario.sourceType,
      createdAt: scenario.createdAt,
      nodes: editorNodes,
      connections: [...editorConnections, ...connections],
    };
  }

  /**
   * DBのresponseTextとresponseAdvancedをエディタ用のresponses配列に変換
   * 画像タグを検出して画像タイプの応答に変換
   */
  private convertToEditorResponses(
    responseText: string | null,
    responseAdvanced: ResponseAdvanced[] | null,
  ): Array<{ id: string; type: 'text' | 'image'; content: string; imageUrl?: string }> {
    const responses: Array<{ id: string; type: 'text' | 'image'; content: string; imageUrl?: string }> = [];

    // responseAdvancedがある場合はそこから変換
    if (responseAdvanced && responseAdvanced.length > 0) {
      responseAdvanced.forEach((adv, idx) => {
        const text = adv.text || '';
        const parsedResponses = this.parseTextWithImages(text, `adv-${idx}`);
        responses.push(...parsedResponses);
      });
    } else if (responseText) {
      // responseTextのみの場合
      const parsedResponses = this.parseTextWithImages(responseText, 'resp');
      responses.push(...parsedResponses);
    }

    // 空の場合はデフォルトの空応答を追加
    if (responses.length === 0) {
      responses.push({ id: '1', type: 'text', content: '' });
    }

    return responses;
  }

  /**
   * テキストから画像タグを解析してresponses配列を生成
   * <img src="..."> や style="background-image:url(...)" を検出
   */
  private parseTextWithImages(
    text: string,
    idPrefix: string,
  ): Array<{ id: string; type: 'text' | 'image'; content: string; imageUrl?: string }> {
    const responses: Array<{ id: string; type: 'text' | 'image'; content: string; imageUrl?: string }> = [];

    // <img>タグを検出
    const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    // background-imageを検出
    const bgImageRegex = /style=["'][^"']*background-image:\s*url\(['"]?([^'")]+)['"]?\)[^"']*["']/gi;

    // 画像URLを抽出
    const imageUrls: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = imgTagRegex.exec(text)) !== null) {
      imageUrls.push(match[1]);
    }
    while ((match = bgImageRegex.exec(text)) !== null) {
      imageUrls.push(match[1]);
    }

    // 画像タグを除去したテキストを取得
    let cleanText = text
      .replace(/<img[^>]*>/gi, '')
      .replace(/<[^>]*style=["'][^"']*background-image:[^"']*["'][^>]*>.*?<\/[^>]+>/gi, '')
      .replace(/<span[^>]*class=["'][^"']*image[^"']*["'][^>]*>.*?<\/span>/gi, '')
      .trim();

    // HTMLタグを除去してプレーンテキストに（基本的なタグのみ保持）
    cleanText = cleanText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim();

    let idCounter = 0;

    // テキストがあれば追加
    if (cleanText) {
      responses.push({
        id: `${idPrefix}-${idCounter++}`,
        type: 'text',
        content: cleanText,
      });
    }

    // 画像があれば追加
    for (const imageUrl of imageUrls) {
      responses.push({
        id: `${idPrefix}-${idCounter++}`,
        type: 'image',
        content: '',
        imageUrl: imageUrl,
      });
    }

    return responses;
  }

  /**
   * responseAdvancedのrepliesをエディタ用のbranches配列に変換
   */
  private convertToEditorBranches(
    responseAdvanced: ResponseAdvanced[] | null,
  ): Array<{
    id: string;
    type: 'button' | 'link' | 'jump' | 'text_input';
    label: string;
    nextNodeId?: string;
    url?: string;
    targetNodeName?: string;
  }> {
    const branches: Array<{
      id: string;
      type: 'button' | 'link' | 'jump' | 'text_input';
      label: string;
      nextNodeId?: string;
      url?: string;
      targetNodeName?: string;
    }> = [];

    if (!responseAdvanced) return branches;

    let idCounter = 0;
    for (const adv of responseAdvanced) {
      if (!adv.replies) continue;

      for (const reply of adv.replies) {
        let branchType: 'button' | 'link' | 'jump' | 'text_input' = 'button';
        let url: string | undefined;
        let targetNodeName: string | undefined;

        switch (reply.type) {
          case 'link':
            branchType = 'link';
            url = reply.linkTarget || reply.value;
            break;
          case 'go_to':
            // 別ノードへのジャンプ
            if (reply.linkTarget) {
              branchType = 'jump';
              targetNodeName = reply.linkTarget;
            } else {
              branchType = 'button';
            }
            break;
          default:
            branchType = 'button';
        }

        branches.push({
          id: reply.id || `branch-${idCounter++}`,
          type: branchType,
          label: reply.label || reply.value || '',
          url,
          targetNodeName,
        });
      }
    }

    return branches;
  }

  /**
   * ノードのparentId関係とresponseAdvancedのchildTriggerTexts/repliesからconnectionsを構築
   */
  private buildConnectionsFromNodes(
    nodes: Array<{
      id: number;
      externalId: string | null;
      parentId: number | null;
      triggerText: string | null;
      nodeName: string | null;
      responseAdvanced: unknown;
    }>,
  ): Array<{ id: string; sourceId: string; targetId: string; sourceHandle?: string }> {
    const connections: Array<{ id: string; sourceId: string; targetId: string; sourceHandle?: string }> = [];
    const nodeIdMap = new Map<number, string>();
    const nameToNodeId = new Map<string, string>(); // triggerTextとnodeNameの両方で検索可能
    const addedConnections = new Set<string>(); // 重複防止用

    // IDマッピングを作成
    nodes.forEach(node => {
      const nodeId = node.externalId || String(node.id);
      nodeIdMap.set(node.id, nodeId);
      // triggerTextからノードIDへのマッピング
      if (node.triggerText) {
        nameToNodeId.set(node.triggerText, nodeId);
      }
      // nodeNameからノードIDへのマッピング（linkTargetの検索用）
      if (node.nodeName) {
        nameToNodeId.set(node.nodeName, nodeId);
      }
    });

    // parentIdからconnectionを生成
    nodes.forEach(node => {
      if (node.parentId && nodeIdMap.has(node.parentId)) {
        const connKey = `${nodeIdMap.get(node.parentId)}->${node.externalId || String(node.id)}`;
        if (!addedConnections.has(connKey)) {
          connections.push({
            id: `conn-parent-${node.id}`,
            sourceId: nodeIdMap.get(node.parentId)!,
            targetId: node.externalId || String(node.id),
          });
          addedConnections.add(connKey);
        }
      }
    });

    // responseAdvancedのchildTriggerTextsからconnectionを生成
    nodes.forEach(node => {
      const responseAdvanced = node.responseAdvanced as ResponseAdvanced[] | null;
      if (!responseAdvanced) return;

      const sourceId = node.externalId || String(node.id);

      for (const adv of responseAdvanced) {
        // childTriggerTextsから接続を構築
        if (adv.childTriggerTexts && Array.isArray(adv.childTriggerTexts)) {
          adv.childTriggerTexts.forEach((triggerText: string, index: number) => {
            const targetId = nameToNodeId.get(triggerText);
            if (targetId) {
              const connKey = `${sourceId}->${targetId}`;
              if (!addedConnections.has(connKey)) {
                connections.push({
                  id: `conn-child-${node.id}-${index}`,
                  sourceId,
                  targetId,
                  sourceHandle: `branch-${index}`,
                });
                addedConnections.add(connKey);
              }
            }
          });
        }

        // repliesのgo_toタイプからも接続を構築
        if (adv.replies && Array.isArray(adv.replies)) {
          adv.replies.forEach((reply, index) => {
            if (reply.type === 'go_to' && reply.linkTarget) {
              // linkTargetはノード名なのでnameToNodeIdから検索
              const targetId = nameToNodeId.get(reply.linkTarget);
              if (targetId) {
                const connKey = `${sourceId}->${targetId}`;
                if (!addedConnections.has(connKey)) {
                  connections.push({
                    id: `conn-reply-${node.id}-${index}`,
                    sourceId,
                    targetId,
                    sourceHandle: `reply-${index}`,
                  });
                  addedConnections.add(connKey);
                }
              }
            }
          });
        }
      }
    });

    return connections;
  }

  /**
   * アクションタイプをノードタイプに変換
   */
  private actionToNodeType(action: string): string {
    switch (action) {
      case 'HANDOVER':
        return 'action';
      case 'RESTART':
      case 'JUMP':
        return 'condition';
      case 'FORM':
        return 'question';
      default:
        return 'message';
    }
  }

  /**
   * ノード位置を計算
   */
  private calculateNodePosition(level: number, order: number): { x: number; y: number } {
    return {
      x: 100 + level * 250,
      y: 100 + order * 150,
    };
  }

  /**
   * エディタからシナリオを新規作成
   * 新形式: position, data, settingsを含む完全なノードデータを保存
   */
  async createScenarioFromEditor(data: {
    name: string;
    targetRole?: string; // "learner", "group_admin", "global_admin" - null/undefinedは全員対象
    nodes?: Array<{
      id: string;
      type: string;
      position?: { x: number; y: number };
      data?: unknown;
      settings?: unknown;
      content?: string;
      metadata?: string;
    }>;
    connections?: Array<{
      id: string;
      sourceId: string;
      targetId: string;
      sourceHandle?: string;
    }>;
  }) {
    const scenario = await this.prisma.scenario.create({
      data: {
        name: data.name,
        targetRole: data.targetRole || null,
        sourceType: 'editor',
        sourceData: {
          nodes: data.nodes || [],
          connections: data.connections || [],
        } as unknown as Prisma.InputJsonValue,
      },
    });

    // ノードを作成（チャット実行用にScenarioNodeテーブルにも保存）
    if (data.nodes && data.nodes.length > 0) {
      for (let i = 0; i < data.nodes.length; i++) {
        const node = data.nodes[i];
        // 新形式と旧形式の両方をサポート
        const nodeData = node.data as { label?: string; responses?: Array<{ content?: string }>; content?: string } | undefined;
        const position = node.position || { x: 100, y: 100 };

        // 応答テキストを取得（新形式: responses配列、旧形式: content）
        let responseText = node.content || '';
        if (nodeData?.responses && nodeData.responses.length > 0) {
          responseText = nodeData.responses.map(r => r.content || '').join('\n---\n');
        } else if (nodeData?.content) {
          responseText = nodeData.content;
        }

        await this.prisma.scenarioNode.create({
          data: {
            scenarioId: scenario.id,
            externalId: node.id,
            level: Math.floor((position.x - 100) / 250),
            triggerText: nodeData?.label || node.type,
            responseText,
            action: this.nodeTypeToAction(node.type),
            order: i,
          },
        });
      }
    }

    return { id: scenario.id, name: scenario.name };
  }

  /**
   * エディタからシナリオを更新
   * 新形式: position, data, settingsを含む完全なノードデータを保存
   * connectionsを使って親子関係を構築
   */
  async updateScenarioFromEditor(
    scenarioId: string,
    data: {
      name?: string;
      targetRole?: string | null; // "learner", "group_admin", "global_admin" - nullは全員対象
      nodes?: Array<{
        id: string;
        type: string;
        position?: { x: number; y: number };
        data?: unknown;
        settings?: unknown;
        content?: string;
        metadata?: string;
      }>;
      connections?: Array<{
        id: string;
        sourceId: string;
        targetId: string;
        sourceHandle?: string;
      }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      // シナリオを更新（sourceDataには完全なエディタの状態を保存）
      await tx.scenario.update({
        where: { id: scenarioId },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.targetRole !== undefined && { targetRole: data.targetRole }),
          sourceType: 'editor',
          sourceData: {
            nodes: data.nodes || [],
            connections: data.connections || [],
          } as unknown as Prisma.InputJsonValue,
        },
      });

      // 既存ノードを削除して再作成
      if (data.nodes && data.nodes.length > 0) {
        await tx.scenarioNode.deleteMany({
          where: { scenarioId },
        });

        // 親→子の接続マップを構築
        const parentToChildren: Map<string, string[]> = new Map();
        const childToParent: Map<string, string> = new Map();
        const allChildIds = new Set<string>();

        if (data.connections && data.connections.length > 0) {
          for (const conn of data.connections) {
            if (!parentToChildren.has(conn.sourceId)) {
              parentToChildren.set(conn.sourceId, []);
            }
            parentToChildren.get(conn.sourceId)!.push(conn.targetId);
            childToParent.set(conn.targetId, conn.sourceId);
            allChildIds.add(conn.targetId);
          }
        }

        // まずすべてのノードを作成（parentIdなし）
        const externalIdToDbId: Map<string, number> = new Map();
        const externalIdToNode: Map<string, typeof data.nodes[0]> = new Map();

        for (const node of data.nodes) {
          externalIdToNode.set(node.id, node);
        }

        for (let i = 0; i < data.nodes.length; i++) {
          const node = data.nodes[i];

          // --- データ検証 ---
          if (!node.id || !node.type) {
            throw new BadRequestException(`ノードデータが無効です。IDまたはタイプがありません。(index: ${i})`);
          }
          const position = node.position;
          if (typeof position?.x !== 'number' || typeof position?.y !== 'number') {
            throw new BadRequestException(`ノードの位置情報が無効です。(id: ${node.id})`);
          }

          // 新形式と旧形式の両方をサポート
          const nodeData = node.data as {
            label?: string;
            responses?: Array<{ content?: string; type?: string; imageUrl?: string }>;
            branches?: Array<{ id: string; type: string; label: string; url?: string; openInNewWindow?: boolean; nextNodeId?: string; targetNodeName?: string }>;
            content?: string;
          } | undefined;
          const nodeSettings = node.settings as { nodeName?: string } | undefined;

          // 応答テキストを取得（新形式: responses配列、旧形式: content）
          let responseText = node.content || '';
          if (nodeData?.responses && nodeData.responses.length > 0) {
            responseText = nodeData.responses.map(r => r.content || '').join('\n---\n');
          } else if (nodeData?.content) {
            responseText = nodeData.content;
          }

          // 子ノードのtriggerTextを取得（responseAdvanced.repliesとのマッチング用）
          const childIds = parentToChildren.get(node.id) || [];
          const childTriggerTexts = childIds.map(childId => {
            const childNode = externalIdToNode.get(childId);
            const childData = childNode?.data as { label?: string } | undefined;
            return childData?.label || childNode?.type || '';
          });

          // responseAdvanced形式で保存（複数応答・ボタン対応）
          const responseAdvanced = this.buildResponseAdvancedFromEditor(nodeData, childTriggerTexts);

          // ルートノード判定: 他のノードからの接続がない = 親がない
          const isRootNode = !allChildIds.has(node.id);
          const level = isRootNode ? 0 : Math.floor((position.x - 100) / 250);
          const triggerText = nodeData?.label || node.type;

          if (isNaN(level)) {
             throw new BadRequestException(`ノードのレベル計算に失敗しました。位置情報が不正な可能性があります。(id: ${node.id})`);
          }

          const createdNode = await tx.scenarioNode.create({
            data: {
              scenarioId,
              externalId: node.id,
              level: level < 0 ? 0 : level,
              triggerText,
              responseText,
              responseAdvanced: responseAdvanced as unknown as Prisma.InputJsonValue,
              action: this.nodeTypeToAction(node.type),
              nodeName: nodeSettings?.nodeName || null,
              order: i,
            },
          });

          externalIdToDbId.set(node.id, createdNode.id);
        }

        // connectionsを使って親子関係を設定
        if (data.connections && data.connections.length > 0) {
          for (const conn of data.connections) {
            const parentDbId = externalIdToDbId.get(conn.sourceId);
            const childDbId = externalIdToDbId.get(conn.targetId);

            if (parentDbId && childDbId) {
              await tx.scenarioNode.update({
                where: { id: childDbId },
                data: { parentId: parentDbId },
              });
            }
          }
        }
      }

      return { success: true };
    });
  }

  /**
   * エディタのノードデータからresponseAdvanced形式を構築
   * childTriggerTexts: このノードの子ノードのtriggerTextリスト（ボタンとのマッチング用）
   */
  private buildResponseAdvancedFromEditor(
    nodeData: {
      responses?: Array<{ content?: string; type?: string; imageUrl?: string }>;
      branches?: Array<{ id: string; type: string; label: string; url?: string; openInNewWindow?: boolean; nextNodeId?: string; targetNodeName?: string }>;
    } | undefined,
    childTriggerTexts?: string[],
  ): object[] | null {
    if (!nodeData) return null;

    const result: object[] = [];

    // 応答メッセージを追加
    if (nodeData.responses && nodeData.responses.length > 0) {
      for (const resp of nodeData.responses) {
        if (resp.type === 'image' && resp.imageUrl) {
          result.push({
            type: 'web_text',
            text: `<img src="${resp.imageUrl}" style="max-width: 100%;" />`,
          });
        } else if (resp.content) {
          result.push({
            type: 'web_text',
            text: resp.content,
          });
        }
      }
    }

    // 分岐条件（ボタン）を追加
    // childTriggerTextsがある場合はそれを使い、なければbranchesを使う
    const branchLabels = childTriggerTexts && childTriggerTexts.length > 0
      ? childTriggerTexts
      : nodeData.branches?.map(b => b.label) || [];

    if (branchLabels.length > 0) {
      const replies = branchLabels.map((label, idx) => {
        const branch = nodeData.branches?.[idx];
        if (branch?.type === 'link') {
          return {
            label: label,
            value: label,
            type: 'link' as const,
            linkTarget: branch.url || '',
            openInNewWindow: branch.openInNewWindow !== false,
          };
        } else if (branch?.type === 'jump') {
          return {
            label: label,
            value: label,
            type: 'go_to' as const,
            linkTarget: branch.targetNodeName,
          };
        } else {
          return {
            label: label,
            value: label,
            type: 'button' as const,
          };
        }
      });

      // 最後のレスポンスにrepliesを追加するか、新しいレスポンスを作成
      if (result.length > 0) {
        (result[result.length - 1] as { replies?: object[] }).replies = replies;
      } else {
        result.push({
          type: 'web_text',
          text: '',
          replies,
        });
      }
    }

    return result.length > 0 ? result : null;
  }

  /**
   * ノードタイプをアクションに変換
   */
  private nodeTypeToAction(nodeType: string): ScenarioAction | null {
    switch (nodeType) {
      case 'action':
        return 'HANDOVER';
      case 'condition':
        return 'JUMP';
      case 'end':
        return 'DROP_OFF'; // 終了ノードはDROP_OFFとして扱う
      default:
        return null;
    }
  }
}
