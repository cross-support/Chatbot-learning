import { PrismaClient, ScenarioAction } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

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
  next_node?: string;
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
  condition_type?: string;
  condition_value?: string;
  condition_link?: string;
  condition_link_target?: string;
  next_node_in?: string;
  next_node_out?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  title?: string;
  content?: string;
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
  conditionLink?: string;
  parentExternalId?: string;
}

interface ResponseAdvanced {
  text: string;
  type: 'web_text' | 'web_form';
  formName?: string;
  replies: ResponseReply[];
}

interface ResponseReply {
  id?: string;
  label: string;
  value: string;
  type: 'go_to' | 'button' | 'link';
  linkTarget?: string;
}

// ==================== インポート関数 ====================

async function importScenario(filePath: string, scenarioName: string) {
  console.log(`\n========================================`);
  console.log(`Importing: ${scenarioName}`);
  console.log(`File: ${filePath}`);
  console.log(`========================================\n`);

  const jsonContent = fs.readFileSync(filePath, 'utf-8');
  const data: EvaScenarioData = JSON.parse(jsonContent);

  if (!data.cells || !Array.isArray(data.cells)) {
    throw new Error('Invalid EVA JSON format: cells array not found');
  }

  // ノードとリンクを分離
  const nodes = data.cells.filter((cell): cell is EvaNode => cell.type === 'devs.Model');
  const links = data.cells.filter((cell): cell is EvaLink => cell.type === 'devs.Link');

  console.log(`Total cells: ${data.cells.length}, Nodes: ${nodes.length}, Links: ${links.length}`);

  // ノードタイプ別にカウント
  const nodeTypeCounts: Record<string, number> = {};
  nodes.forEach(n => {
    nodeTypeCounts[n.nodeType] = (nodeTypeCounts[n.nodeType] || 0) + 1;
  });
  console.log('Node types:', nodeTypeCounts);

  // シナリオを作成
  const scenario = await prisma.scenario.create({
    data: {
      name: scenarioName,
      sourceType: 'eva',
      sourceData: data as object,
      isActive: true,
    },
  });

  console.log(`Created scenario: ${scenario.id}`);

  // リンクマップを構築（source -> target[]）
  const linkMap = buildLinkMap(links);

  // スタートノードを見つける
  const startNode = nodes.find(n => n.nodeType === 'dialogue.start');
  if (!startNode) {
    throw new Error('スタートノードが見つかりません');
  }

  const startNextNodeId = startNode.state?.next_node || linkMap.get(startNode.id)?.[0];
  if (!startNextNodeId) {
    throw new Error('スタートノードから接続されているノードがありません');
  }

  console.log(`Start node: ${startNode.id}, Next: ${startNextNodeId}`);

  // 全ノードをパース（親子関係の情報を含む）
  const parsedNodes = parseAllNodes(nodes, linkMap);
  console.log(`Parsed nodes: ${parsedNodes.size}`);

  // ノード名 -> 外部ID のマッピングを構築
  const nodeNameToExternalId = new Map<string, string>();
  for (const [extId, parsed] of parsedNodes) {
    if (parsed.nodeName) {
      nodeNameToExternalId.set(parsed.nodeName, extId);
    }
    if (parsed.memoryName) {
      nodeNameToExternalId.set(parsed.memoryName, extId);
    }
  }
  console.log(`Node name mappings: ${nodeNameToExternalId.size}`);

  // 外部ID → 内部ID のマッピング
  const externalToInternalId = new Map<string, number>();

  // フェーズ1: 全dialogue.responseノードをインポート（親子関係なし）
  console.log('\nPhase 1: Importing dialogue.response nodes...');
  for (const [extId, parsed] of parsedNodes) {
    if (parsed.nodeType === 'dialogue.response') {
      const createdNode = await prisma.scenarioNode.create({
        data: {
          scenarioId: scenario.id,
          parentId: null,
          externalId: parsed.externalId,
          nodeType: parsed.nodeType,
          level: 1,
          triggerText: parsed.triggerText,
          responseText: parsed.responseText,
          responseAdvanced: parsed.responseAdvanced as object,
          action: parsed.action,
          actionValue: parsed.actionValue,
          actionConfig: parsed.actionConfig as object,
          nodeName: parsed.nodeName || parsed.memoryName,
          order: parsed.order,
        },
      });
      externalToInternalId.set(extId, createdNode.id);
    }
  }
  console.log(`Imported ${externalToInternalId.size} dialogue.response nodes`);

  // フェーズ2: dialogue.jointノードをインポート
  console.log('\nPhase 2: Importing dialogue.joint nodes...');
  let jointCount = 0;
  for (const [extId, parsed] of parsedNodes) {
    if (parsed.nodeType === 'dialogue.joint') {
      // 親ノードを探す
      let parentInternalId: number | null = null;
      if (parsed.parentExternalId) {
        parentInternalId = externalToInternalId.get(parsed.parentExternalId) || null;
      }

      const createdNode = await prisma.scenarioNode.create({
        data: {
          scenarioId: scenario.id,
          parentId: parentInternalId,
          externalId: parsed.externalId,
          nodeType: parsed.nodeType,
          level: parentInternalId ? 2 : 1,
          triggerText: parsed.triggerText,
          responseText: parsed.responseText,
          action: parsed.action,
          actionValue: parsed.actionValue,
          actionConfig: parsed.actionConfig as object,
          nodeName: parsed.nodeName || parsed.memoryName,
          order: parsed.order,
        },
      });
      externalToInternalId.set(extId, createdNode.id);
      jointCount++;
    }
  }
  console.log(`Imported ${jointCount} dialogue.joint nodes`);

  // フェーズ3: システムノードをインポート
  console.log('\nPhase 3: Importing system nodes...');
  let systemCount = 0;
  for (const [extId, parsed] of parsedNodes) {
    if (parsed.nodeType.startsWith('system.')) {
      const createdNode = await prisma.scenarioNode.create({
        data: {
          scenarioId: scenario.id,
          parentId: null,
          externalId: parsed.externalId,
          nodeType: parsed.nodeType,
          level: 1,
          triggerText: parsed.triggerText,
          responseText: parsed.responseText,
          action: parsed.action,
          actionValue: parsed.actionValue,
          actionConfig: parsed.actionConfig as object,
          nodeName: parsed.nodeName,
          order: parsed.order,
        },
      });
      externalToInternalId.set(extId, createdNode.id);
      systemCount++;
    }
  }
  console.log(`Imported ${systemCount} system nodes`);

  // フェーズ4: JUMPアクションのターゲットを解決（ノード名 -> 内部ID）
  console.log('\nPhase 4: Resolving JUMP targets...');
  const nodeNameToInternalId = new Map<string, number>();
  for (const [extId, internalId] of externalToInternalId) {
    const parsed = parsedNodes.get(extId);
    if (parsed?.nodeName) {
      nodeNameToInternalId.set(parsed.nodeName, internalId);
    }
    if (parsed?.memoryName) {
      nodeNameToInternalId.set(parsed.memoryName, internalId);
    }
  }

  const jumpNodes = await prisma.scenarioNode.findMany({
    where: {
      scenarioId: scenario.id,
      action: 'JUMP',
    },
  });

  for (const node of jumpNodes) {
    if (node.actionValue) {
      const targetInternalId = nodeNameToInternalId.get(node.actionValue);
      if (targetInternalId) {
        await prisma.scenarioNode.update({
          where: { id: node.id },
          data: { actionValue: String(targetInternalId) },
        });
      }
    }
  }
  console.log(`Resolved ${jumpNodes.length} JUMP targets`);

  // フェーズ5: ルートノードの親子関係を更新
  console.log('\nPhase 5: Updating root node parent relationships...');
  const rootNodeInternalId = externalToInternalId.get(startNextNodeId);
  if (rootNodeInternalId) {
    // ルートノードに埋め込まれている選択肢の親IDを設定
    const rootParsed = parsedNodes.get(startNextNodeId);
    if (rootParsed) {
      for (const embedId of rootParsed.embeddedChildIds) {
        const childInternalId = externalToInternalId.get(embedId);
        if (childInternalId) {
          await prisma.scenarioNode.update({
            where: { id: childInternalId },
            data: { parentId: rootNodeInternalId, level: 2 },
          });
        }
      }
    }
  }

  console.log(`\nTotal imported: ${externalToInternalId.size} nodes`);

  return { scenarioId: scenario.id, imported: externalToInternalId.size, errors: [] };
}

function buildLinkMap(links: EvaLink[]): Map<string, string[]> {
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

function parseAllNodes(
  nodes: EvaNode[],
  linkMap: Map<string, string[]>,
): Map<string, ParsedScenarioNode> {
  const parsedMap = new Map<string, ParsedScenarioNode>();

  // まず、親子関係のマッピングを構築
  const childToParent = new Map<string, string>();
  for (const node of nodes) {
    if (node.embeds) {
      for (const childId of node.embeds) {
        childToParent.set(childId, node.id);
      }
    }
  }

  for (const node of nodes) {
    const parsed = parseSingleNode(node, linkMap, childToParent);
    if (parsed) {
      parsedMap.set(node.id, parsed);
    }
  }

  return parsedMap;
}

function parseSingleNode(
  node: EvaNode,
  linkMap: Map<string, string[]>,
  childToParent: Map<string, string>,
): ParsedScenarioNode | null {
  const state = node.state || {};

  if (node.nodeType === 'dialogue.start') {
    return null;
  }

  let action: ScenarioAction | undefined;
  let actionValue: string | undefined;
  let actionConfig: Record<string, unknown> | undefined;
  let conditionLink: string | undefined;

  switch (node.nodeType) {
    case 'dialogue.response':
      if (state.response_advance?.some(adv => adv.response_type === 'web_form')) {
        action = 'FORM';
        actionConfig = {
          formFields: state.memory?.forms || [],
        };
      }
      break;

    case 'dialogue.joint':
      conditionLink = state.condition_link;
      actionConfig = {
        conditionType: state.condition_type,
        conditionValue: state.condition_value,
        conditionLink: state.condition_link,
        conditionLinkTarget: state.condition_link_target,
      };

      switch (state.condition_type) {
        case 'go_to':
          if (state.condition_link === 'START' || state.condition_value === 'はじめに戻る') {
            action = 'RESTART';
          } else if (state.condition_link) {
            action = 'JUMP';
            actionValue = state.condition_link; // ノード名
          }
          break;

        case 'button':
          if (state.condition_value?.includes('オペレーター')) {
            action = 'HANDOVER';
          }
          break;

        case 'link':
          action = 'LINK';
          actionValue = state.condition_link || state.condition_link_target;
          break;

        case 'submit_form':
          action = 'FORM';
          actionConfig.formSubmit = true;
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
  }

  const responseText = state.response_text || '';

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

  let triggerText = '';
  if (node.nodeType === 'dialogue.joint') {
    triggerText = state.condition_value || 'オプション';
  } else if (node.nodeType === 'dialogue.response') {
    triggerText = state.node_name?.name || state.memory?.name || 'ノード';
  } else {
    triggerText = state.node_name?.name || node.nodeType;
  }

  const embeddedChildIds = node.embeds || [];
  const linkedTargetIds = linkMap.get(node.id) || [];
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
    conditionLink,
    parentExternalId: childToParent.get(node.id),
  };
}

// ==================== メイン ====================

async function main() {
  console.log('Starting scenario import...\n');

  // 既存のシナリオを削除（クリーンインポート）
  console.log('Clearing existing scenarios...');
  await prisma.scenarioNode.deleteMany({});
  await prisma.scenario.deleteMany({});
  console.log('Done.\n');

  // シナリオファイルのパスを設定
  const baseDir = path.resolve(__dirname, '../../../../');

  // scenario_1.json をインポート（ユーザー向け）
  const result1 = await importScenario(
    path.join(baseDir, 'scenario_1.json'),
    'ユーザー向けシナリオ'
  );
  console.log(`\nScenario 1 imported: ${result1.imported} nodes\n`);

  // scenario_2.json をインポート（管理者向け）
  const result2 = await importScenario(
    path.join(baseDir, 'scenario_2.json'),
    '管理者向けシナリオ'
  );
  console.log(`\nScenario 2 imported: ${result2.imported} nodes\n`);

  // 管理者向けシナリオを非アクティブに
  await prisma.scenario.updateMany({
    where: { name: '管理者向けシナリオ' },
    data: { isActive: false },
  });

  console.log('\n========================================');
  console.log('Import completed!');
  console.log('========================================');

  // 結果を確認
  const scenarios = await prisma.scenario.findMany({
    include: {
      _count: {
        select: { nodes: true },
      },
    },
  });
  console.log('\nScenarios:');
  scenarios.forEach((s: { name: string; _count: { nodes: number }; isActive: boolean }) => {
    console.log(`  - ${s.name}: ${s._count.nodes} nodes (active: ${s.isActive})`);
  });
}

main()
  .catch(e => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
