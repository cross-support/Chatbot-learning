import { PrismaClient, ScenarioAction } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// HTMLタグを除去してテキストを整形
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<wbr\s*\/?>/gi, '')
    .replace(/<img[^>]*>/gi, '') // 画像タグを除去（後で別途処理）
    .replace(/<[^>]+>/g, '')
    .replace(/&rarr;/g, '→')
    .replace(/&hArr;/g, '⇔')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}

// 画像URLを抽出
function extractImageUrls(html: string): string[] {
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  const urls: string[] = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

interface EVACell {
  id: string;
  type: string;
  nodeType?: string;
  state?: {
    node_name?: { name: string };
    response_text?: string;
    response_advance?: Array<{
      response_type: string;
      response_text?: string;
      replies?: Array<{
        reply_type: string;
        reply_value: string;
        reply_link?: string;
        id?: string;
      }>;
    }>;
    next_node?: string;
    condition_type?: string;
    condition_value?: string;
    condition_link?: string;
    memory?: { forms?: string[]; name?: string };
    to?: string;
    content?: string;
  };
  embeds?: string[];
}

interface ParsedNode {
  id: string;
  nodeType: string;
  nodeName: string;
  responseTexts: string[];
  imageUrls: string[];
  replies: Array<{
    type: string;
    value: string;
    link: string;
    targetId: string;
  }>;
  forms: string[];
  mailConfig?: { to: string; content: string };
}

function parseEVAScenario(jsonData: { cells: EVACell[] }): {
  nodes: Map<string, ParsedNode>;
  joints: Map<string, { targetId: string; conditionType: string; conditionValue: string; conditionLink: string }>;
  startNodeId: string;
} {
  const nodes = new Map<string, ParsedNode>();
  const joints = new Map<string, { targetId: string; conditionType: string; conditionValue: string; conditionLink: string }>();
  let startNodeId = '';

  for (const cell of jsonData.cells) {
    if (cell.type === 'devs.Link') continue;

    const nodeType = cell.nodeType || '';
    const state = cell.state || {};

    if (nodeType === 'dialogue.start') {
      startNodeId = state.next_node || '';
    } else if (nodeType === 'dialogue.response') {
      const nodeName = state.node_name?.name || '';
      const responseAdvance = state.response_advance || [];
      const responseTexts: string[] = [];
      const imageUrls: string[] = [];
      const replies: ParsedNode['replies'] = [];
      const forms = state.memory?.forms || [];

      for (const adv of responseAdvance) {
        if (adv.response_text) {
          responseTexts.push(stripHtml(adv.response_text));
          imageUrls.push(...extractImageUrls(adv.response_text));
        }
        if (adv.replies) {
          for (const r of adv.replies) {
            replies.push({
              type: r.reply_type || 'go_to',
              value: r.reply_value || '',
              link: r.reply_link || '',
              targetId: r.id || '',
            });
          }
        }
      }

      nodes.set(cell.id, {
        id: cell.id,
        nodeType,
        nodeName,
        responseTexts,
        imageUrls,
        replies,
        forms,
      });
    } else if (nodeType === 'dialogue.joint') {
      const conditionType = state.condition_type || '';
      const conditionValue = state.condition_value || '';
      const conditionLink = state.condition_link || '';
      const targetId = state.next_node || '';

      joints.set(cell.id, {
        targetId,
        conditionType,
        conditionValue,
        conditionLink,
      });
    } else if (nodeType === 'system.mail') {
      // メール設定は後で親ノードに紐付け
    } else if (nodeType === 'system.rtchat') {
      nodes.set(cell.id, {
        id: cell.id,
        nodeType: 'system.rtchat',
        nodeName: '有人チャット切替',
        responseTexts: [],
        imageUrls: [],
        replies: [],
        forms: [],
      });
    }
  }

  return { nodes, joints, startNodeId };
}

async function importScenario(
  name: string,
  description: string,
  filePath: string
) {
  console.log(`\n=== ${name} のインポート開始 ===`);

  // JSONファイルを読み込み
  const jsonContent = fs.readFileSync(filePath, 'utf-8');
  const jsonData = JSON.parse(jsonContent);

  const { nodes, joints, startNodeId } = parseEVAScenario(jsonData);

  console.log(`  パース完了: ${nodes.size} ノード, ${joints.size} ジョイント`);
  console.log(`  開始ノード: ${startNodeId.substring(0, 20)}...`);

  // Scenarioを作成
  const scenario = await prisma.scenario.create({
    data: {
      name,
      description,
      sourceType: 'eva',
      sourceData: jsonData,
    },
  });

  console.log(`  Scenario作成: ${scenario.id}`);

  // ノードの親子関係を構築
  // EVAでは embeds で子ノードを指定、または joints で遷移先を指定

  // まずルートノード（STARTからの遷移先）を作成
  const startNode = nodes.get(startNodeId);
  if (!startNode) {
    console.log('  警告: 開始ノードが見つかりません');
    return;
  }

  // ノードIDとDBのIDのマッピング
  const nodeIdMap = new Map<string, number>();

  // 再帰的にノードを作成
  async function createNode(
    evaId: string,
    parentDbId: number | null,
    level: number,
    order: number
  ): Promise<number | null> {
    const node = nodes.get(evaId);
    if (!node) {
      // jointの場合は遷移先を取得
      const joint = joints.get(evaId);
      if (joint && joint.conditionType === 'go_to') {
        // go_toは次のノードへの遷移なので、遷移先ノードを探す
        return null;
      }
      return null;
    }

    // すでに作成済みの場合はスキップ（循環参照防止）
    if (nodeIdMap.has(evaId)) {
      return nodeIdMap.get(evaId)!;
    }

    // アクションを判定
    let action: ScenarioAction | null = null;
    let actionValue: string | null = null;

    if (node.nodeType === 'system.rtchat') {
      action = 'HANDOVER';
    }

    // 応答テキストを結合
    const responseText = node.responseTexts.join('\n\n');

    // DBにノードを作成
    const dbNode = await prisma.scenarioNode.create({
      data: {
        scenarioId: scenario.id,
        externalId: evaId,
        nodeType: node.nodeType,
        parentId: parentDbId,
        level,
        triggerText: node.nodeName || `ノード${order + 1}`,
        responseText,
        responseAdvanced: {
          texts: node.responseTexts,
          images: node.imageUrls,
        },
        nodeName: node.nodeName,
        action,
        actionValue,
        order,
      },
    });

    nodeIdMap.set(evaId, dbNode.id);

    // 子ノード（選択肢）を作成
    for (let i = 0; i < node.replies.length; i++) {
      const reply = node.replies[i];

      // アクションを判定
      let childAction: ScenarioAction | null = null;
      let childActionValue: string | null = null;

      if (reply.type === 'button') {
        childAction = 'HANDOVER';
      } else if (reply.type === 'link' && reply.link) {
        childAction = 'LINK';
        childActionValue = reply.link;
      } else if (reply.value === 'はじめに戻る' || reply.link === 'START') {
        childAction = 'RESTART';
      }

      // 選択肢のジョイントを探す
      const joint = joints.get(reply.targetId);
      let nextNodeId = joint?.targetId || '';
      const conditionLink = joint?.conditionLink || reply.link || '';

      // 遷移先ノードの応答を取得
      let childResponseText = '';
      if (nextNodeId) {
        const nextNode = nodes.get(nextNodeId);
        if (nextNode) {
          childResponseText = nextNode.responseTexts.join('\n\n');
        }
      }

      // 子ノードを作成
      await prisma.scenarioNode.create({
        data: {
          scenarioId: scenario.id,
          externalId: reply.targetId,
          nodeType: 'dialogue.joint',
          parentId: dbNode.id,
          level: level + 1,
          triggerText: reply.value,
          responseText: childResponseText,
          nodeName: conditionLink,
          action: childAction,
          actionValue: childActionValue,
          order: i,
        },
      });
    }

    return dbNode.id;
  }

  // ルートノードから作成開始
  await createNode(startNodeId, null, 0, 0);

  const totalNodes = await prisma.scenarioNode.count({
    where: { scenarioId: scenario.id },
  });

  console.log(`  完了: ${totalNodes} ノードを作成`);
}

async function importScenarioSimple(
  name: string,
  description: string,
  filePath: string
) {
  console.log(`\n=== ${name} のインポート開始 (簡易版) ===`);

  const jsonContent = fs.readFileSync(filePath, 'utf-8');
  const jsonData = JSON.parse(jsonContent);

  // Scenarioを作成
  const scenario = await prisma.scenario.create({
    data: {
      name,
      description,
      sourceType: 'eva',
      sourceData: jsonData,
    },
  });

  const cells = jsonData.cells || [];

  // dialogue.response ノードを抽出
  const responseNodes: EVACell[] = cells.filter(
    (c: EVACell) => c.nodeType === 'dialogue.response'
  );

  // dialogue.joint（選択肢の接続点）を抽出
  const jointMap = new Map<string, EVACell>();
  for (const cell of cells) {
    if (cell.nodeType === 'dialogue.joint') {
      jointMap.set(cell.id, cell);
    }
  }

  // 開始ノードを特定
  const startCell = cells.find((c: EVACell) => c.nodeType === 'dialogue.start');
  const startNodeId = startCell?.state?.next_node || '';

  console.log(`  response ノード数: ${responseNodes.length}`);
  console.log(`  joint ノード数: ${jointMap.size}`);

  // EVA ID → DB ID のマッピング
  const nodeIdMap = new Map<string, number>();

  // ルートノードを特定
  const rootNode = responseNodes.find((n) => n.id === startNodeId);
  if (!rootNode) {
    console.log('  エラー: ルートノードが見つかりません');
    return;
  }

  // レベル1のノードを作成（ルートの選択肢から遷移するノード）
  const rootState = rootNode.state || {};
  const rootAdvance = rootState.response_advance || [];

  // ルートメッセージを作成
  const rootTexts: string[] = [];
  for (const adv of rootAdvance) {
    if (adv.response_text && !adv.replies) {
      rootTexts.push(stripHtml(adv.response_text));
    }
  }

  // ルートの選択肢を取得
  const rootReplies: Array<{ value: string; targetId: string; type: string; link: string }> = [];
  for (const adv of rootAdvance) {
    if (adv.replies) {
      for (const r of adv.replies) {
        rootReplies.push({
          value: r.reply_value || '',
          targetId: r.id || '',
          type: r.reply_type || 'go_to',
          link: r.reply_link || '',
        });
      }
    }
  }

  console.log(`  ルートメッセージ: ${rootTexts.length}個`);
  console.log(`  ルート選択肢: ${rootReplies.length}個`);

  // 再帰的にノードを処理
  async function processNode(
    evaCell: EVACell,
    parentDbId: number | null,
    level: number,
    order: number,
    triggerText: string
  ): Promise<number> {
    const state = evaCell.state || {};
    const advance = state.response_advance || [];

    // 応答テキストを抽出
    const responseTexts: string[] = [];
    const imageUrls: string[] = [];
    for (const adv of advance) {
      if (adv.response_text) {
        responseTexts.push(stripHtml(adv.response_text));
        imageUrls.push(...extractImageUrls(adv.response_text));
      }
    }

    // 選択肢を抽出
    const replies: Array<{ value: string; targetId: string; type: string; link: string }> = [];
    for (const adv of advance) {
      if (adv.replies) {
        for (const r of adv.replies) {
          replies.push({
            value: r.reply_value || '',
            targetId: r.id || '',
            type: r.reply_type || 'go_to',
            link: r.reply_link || '',
          });
        }
      }
    }

    const nodeName = state.node_name?.name || '';

    // ノードを作成
    const dbNode = await prisma.scenarioNode.create({
      data: {
        scenarioId: scenario.id,
        externalId: evaCell.id,
        nodeType: evaCell.nodeType || '',
        parentId: parentDbId,
        level,
        triggerText: triggerText || nodeName || `ノード${order + 1}`,
        responseText: responseTexts.join('\n\n'),
        responseAdvanced: { texts: responseTexts, images: imageUrls },
        nodeName,
        order,
      },
    });

    nodeIdMap.set(evaCell.id, dbNode.id);

    // 選択肢を処理
    for (let i = 0; i < replies.length; i++) {
      const reply = replies[i];

      // アクションを判定
      let action: ScenarioAction | null = null;
      let actionValue: string | null = null;

      if (reply.type === 'button') {
        action = 'HANDOVER';
      } else if (reply.type === 'link' && reply.link) {
        action = 'LINK';
        actionValue = reply.link;
      } else if (reply.value === 'はじめに戻る' || reply.link === 'START') {
        action = 'RESTART';
      }

      // ジョイントから遷移先を取得
      const joint = jointMap.get(reply.targetId);
      const nextNodeId = joint?.state?.next_node || '';
      const conditionLink = joint?.state?.condition_link || reply.link || '';

      // 遷移先ノードを探す
      let nextNode: EVACell | undefined;
      if (conditionLink && conditionLink !== 'START') {
        nextNode = responseNodes.find(
          (n) => n.state?.node_name?.name === conditionLink
        );
      }
      if (!nextNode && nextNodeId) {
        nextNode = responseNodes.find((n) => n.id === nextNodeId);
      }

      // 遷移先の応答テキストを取得
      let childResponseText = '';
      if (nextNode) {
        const nextAdvance = nextNode.state?.response_advance || [];
        const nextTexts: string[] = [];
        for (const adv of nextAdvance) {
          if (adv.response_text) {
            nextTexts.push(stripHtml(adv.response_text));
          }
        }
        childResponseText = nextTexts.join('\n\n');
      }

      // 子ノードを作成
      const childNode = await prisma.scenarioNode.create({
        data: {
          scenarioId: scenario.id,
          externalId: reply.targetId,
          nodeType: 'choice',
          parentId: dbNode.id,
          level: level + 1,
          triggerText: reply.value,
          responseText: childResponseText,
          nodeName: conditionLink,
          action,
          actionValue,
          order: i,
        },
      });

      // 遷移先ノードがあり、まだ処理していない場合は再帰処理
      if (nextNode && !nodeIdMap.has(nextNode.id) && action !== 'RESTART' && action !== 'LINK') {
        // 遷移先ノードの選択肢を処理
        const nextAdvance = nextNode.state?.response_advance || [];
        const nextReplies: Array<{ value: string; targetId: string; type: string; link: string }> = [];
        for (const adv of nextAdvance) {
          if (adv.replies) {
            for (const r of adv.replies) {
              nextReplies.push({
                value: r.reply_value || '',
                targetId: r.id || '',
                type: r.reply_type || 'go_to',
                link: r.reply_link || '',
              });
            }
          }
        }

        // 遷移先の選択肢を子ノードとして追加
        for (let j = 0; j < nextReplies.length; j++) {
          const nextReply = nextReplies[j];

          let nextAction: ScenarioAction | null = null;
          let nextActionValue: string | null = null;

          if (nextReply.type === 'button') {
            nextAction = 'HANDOVER';
          } else if (nextReply.type === 'link' && nextReply.link) {
            nextAction = 'LINK';
            nextActionValue = nextReply.link;
          } else if (nextReply.value === 'はじめに戻る' || nextReply.link === 'START') {
            nextAction = 'RESTART';
          }

          const nextJoint = jointMap.get(nextReply.targetId);
          const grandchildLink = nextJoint?.state?.condition_link || nextReply.link || '';

          // 孫ノードの遷移先を探す
          let grandchildNode: EVACell | undefined;
          if (grandchildLink && grandchildLink !== 'START') {
            grandchildNode = responseNodes.find(
              (n) => n.state?.node_name?.name === grandchildLink
            );
          }

          let grandchildResponseText = '';
          if (grandchildNode) {
            const gcAdvance = grandchildNode.state?.response_advance || [];
            const gcTexts: string[] = [];
            for (const adv of gcAdvance) {
              if (adv.response_text) {
                gcTexts.push(stripHtml(adv.response_text));
              }
            }
            grandchildResponseText = gcTexts.join('\n\n');
          }

          await prisma.scenarioNode.create({
            data: {
              scenarioId: scenario.id,
              externalId: `${nextReply.targetId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              nodeType: 'choice',
              parentId: childNode.id,
              level: level + 2,
              triggerText: nextReply.value,
              responseText: grandchildResponseText,
              nodeName: grandchildLink,
              action: nextAction,
              actionValue: nextActionValue,
              order: j,
            },
          });
        }
      }
    }

    return dbNode.id;
  }

  // ルートノードを処理
  await processNode(rootNode, null, 0, 0, 'START');

  const totalNodes = await prisma.scenarioNode.count({
    where: { scenarioId: scenario.id },
  });

  console.log(`  完了: ${totalNodes} ノードを作成`);

  return scenario;
}

async function main() {
  console.log('既存のシナリオデータを削除...');
  await prisma.scenarioNode.deleteMany();
  await prisma.scenario.deleteMany();

  const baseDir = '/Users/apple/Desktop/クロスリンク様/チャットボット開発';

  // 受講者用シナリオ
  await importScenarioSimple(
    '受講者用シナリオ',
    'Cross Learning受講者向けのサポートシナリオ（scenario_1.txt）',
    path.join(baseDir, 'scenario_1.txt')
  );

  // 管理者用シナリオ
  await importScenarioSimple(
    '管理者用シナリオ',
    'Cross Learning管理者向けのサポートシナリオ（scenario_2.txt）',
    path.join(baseDir, 'scenario_2.txt')
  );

  // 統計表示
  const scenarios = await prisma.scenario.findMany({
    include: { _count: { select: { nodes: true } } },
  });

  console.log('\n=== インポート結果 ===');
  for (const s of scenarios) {
    console.log(`  ${s.name}: ${s._count.nodes} ノード`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
