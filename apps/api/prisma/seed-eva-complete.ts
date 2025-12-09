import { PrismaClient, ScenarioAction } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

// HTMLタグを整形
function cleanHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<wbr\s*\/?>/gi, '')
    .replace(/<img[^>]*>/gi, '[画像]')
    .replace(/<span[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<div[^>]*>/gi, '')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&rarr;/g, '→')
    .replace(/&hArr;/g, '⇔')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface Reply {
  reply_type: string;
  reply_value: string;
  reply_link?: string;
  id?: string;
}

interface ResponseAdvance {
  response_type: string;
  response_text?: string;
  replies?: Reply[];
}

interface NodeState {
  node_name?: { name: string };
  response_advance?: ResponseAdvance[];
  next_node?: string;
  condition_type?: string;
  condition_value?: string;
  condition_link?: string;
}

interface EVACell {
  id: string;
  type: string;
  nodeType?: string;
  state?: NodeState;
}

interface EVAData {
  cells: EVACell[];
}

async function importEVAScenario(name: string, description: string, filePath: string) {
  console.log(`\n========================================`);
  console.log(`${name} のインポート開始`);
  console.log(`========================================`);

  const jsonContent = fs.readFileSync(filePath, 'utf-8');
  const data: EVAData = JSON.parse(jsonContent);
  const cells = data.cells;

  // Scenario作成
  const scenario = await prisma.scenario.create({
    data: { name, description, sourceType: 'eva' },
  });

  // ノード分類
  const responseNodes = new Map<string, EVACell>();
  const jointNodes = new Map<string, EVACell>();
  let startNextId = '';

  for (const cell of cells) {
    if (cell.type === 'devs.Link') continue;

    if (cell.nodeType === 'dialogue.start') {
      startNextId = cell.state?.next_node || '';
    } else if (cell.nodeType === 'dialogue.response') {
      responseNodes.set(cell.id, cell);
    } else if (cell.nodeType === 'dialogue.joint') {
      jointNodes.set(cell.id, cell);
    }
  }

  console.log(`  response ノード: ${responseNodes.size}`);
  console.log(`  joint ノード: ${jointNodes.size}`);
  console.log(`  開始ノードID: ${startNextId.substring(0, 20)}...`);

  // ノード名 → EVA Cell のマッピング
  const nodeByName = new Map<string, EVACell>();
  for (const [, cell] of responseNodes) {
    const nodeName = cell.state?.node_name?.name;
    if (nodeName) {
      nodeByName.set(nodeName, cell);
    }
  }

  // EVA ID → DB ID のマッピング
  const processedIds = new Set<string>();
  let nodeCounter = 0;

  // ノードを処理する関数
  async function processResponseNode(
    cell: EVACell,
    parentDbId: number | null,
    level: number,
    triggerText: string,
    order: number
  ): Promise<number> {
    // 既に処理済みならスキップ
    if (processedIds.has(cell.id)) {
      console.log(`    [スキップ] 既処理: ${cell.state?.node_name?.name || cell.id.substring(0, 15)}`);
      return -1;
    }
    processedIds.add(cell.id);

    const state = cell.state || {};
    const nodeName = state.node_name?.name || '';
    const advance = state.response_advance || [];

    // 応答テキストを抽出
    const responseTexts: string[] = [];
    const replies: Reply[] = [];

    for (const adv of advance) {
      if (adv.response_text) {
        responseTexts.push(cleanHtml(adv.response_text));
      }
      if (adv.replies) {
        replies.push(...adv.replies);
      }
    }

    const responseText = responseTexts.join('\n\n');

    // DBにノード作成
    const dbNode = await prisma.scenarioNode.create({
      data: {
        scenarioId: scenario.id,
        externalId: cell.id,
        nodeType: cell.nodeType || '',
        parentId: parentDbId,
        level,
        triggerText: triggerText || nodeName || 'ノード',
        responseText,
        nodeName,
        order,
      },
    });

    nodeCounter++;
    console.log(`    [${nodeCounter}] ${nodeName || triggerText} (レベル${level}, 選択肢${replies.length}個)`);

    // 選択肢を処理
    for (let i = 0; i < replies.length; i++) {
      const reply = replies[i];
      const replyValue = reply.reply_value || '';
      const replyType = reply.reply_type || 'go_to';
      const replyLink = reply.reply_link || '';
      const targetJointId = reply.id || '';

      // アクション判定
      let action: ScenarioAction | null = null;
      let actionValue: string | null = null;

      if (replyType === 'button') {
        action = 'HANDOVER';
      } else if (replyType === 'link' && replyLink) {
        action = 'LINK';
        actionValue = replyLink;
      } else if (replyValue === 'はじめに戻る' || replyLink === 'START') {
        action = 'RESTART';
      }

      // ジョイントから遷移先を取得
      const joint = jointNodes.get(targetJointId);
      const conditionLink = joint?.state?.condition_link || replyLink || '';

      // 遷移先のresponseノードを探す
      let nextCell: EVACell | undefined;
      if (conditionLink && conditionLink !== 'START') {
        nextCell = nodeByName.get(conditionLink);
      }

      // 遷移先の応答テキストを取得
      let childResponseText = '';
      if (nextCell && !processedIds.has(nextCell.id)) {
        const nextAdvance = nextCell.state?.response_advance || [];
        const nextTexts: string[] = [];
        for (const adv of nextAdvance) {
          if (adv.response_text) {
            nextTexts.push(cleanHtml(adv.response_text));
          }
        }
        childResponseText = nextTexts.join('\n\n');
      }

      // 選択肢ノードを作成
      const childNode = await prisma.scenarioNode.create({
        data: {
          scenarioId: scenario.id,
          externalId: `choice_${dbNode.id}_${i}`,
          nodeType: 'choice',
          parentId: dbNode.id,
          level: level + 1,
          triggerText: replyValue,
          responseText: childResponseText,
          nodeName: conditionLink,
          action,
          actionValue,
          order: i,
        },
      });

      nodeCounter++;

      // 遷移先ノードが未処理で、特殊アクションでなければ再帰処理
      if (nextCell && !processedIds.has(nextCell.id) && !action) {
        await processResponseNode(nextCell, childNode.id, level + 2, conditionLink, 0);
      }
    }

    return dbNode.id;
  }

  // ルートノードから処理開始
  const rootCell = responseNodes.get(startNextId);
  if (rootCell) {
    await processResponseNode(rootCell, null, 0, 'START', 0);
  } else {
    console.log('  警告: ルートノードが見つかりません');
  }

  // 結果表示
  const totalNodes = await prisma.scenarioNode.count({
    where: { scenarioId: scenario.id },
  });

  console.log(`\n  完了: ${totalNodes} ノードをインポート`);
  console.log(`  (EVA responseノード ${responseNodes.size} → DB ${totalNodes}ノード)`);

  return scenario;
}

async function main() {
  console.log('既存データを削除...');
  await prisma.scenarioNode.deleteMany();
  await prisma.scenario.deleteMany();

  const baseDir = '/Users/apple/Desktop/クロスリンク様/チャットボット開発';

  // 受講者用シナリオ
  await importEVAScenario(
    '受講者用シナリオ',
    'Cross Learning受講者向けサポート（scenario_1.txt）',
    `${baseDir}/scenario_1.txt`
  );

  // 管理者用シナリオ
  await importEVAScenario(
    '管理者用シナリオ',
    'Cross Learning管理者向けサポート（scenario_2.txt）',
    `${baseDir}/scenario_2.txt`
  );

  // 統計
  console.log('\n========================================');
  console.log('インポート結果');
  console.log('========================================');

  const scenarios = await prisma.scenario.findMany({
    include: { _count: { select: { nodes: true } } },
  });

  for (const s of scenarios) {
    console.log(`  ${s.name}: ${s._count.nodes} ノード`);
  }

  // 各シナリオのルートノード選択肢を表示
  for (const s of scenarios) {
    const rootNodes = await prisma.scenarioNode.findMany({
      where: { scenarioId: s.id, level: 0 },
    });

    console.log(`\n【${s.name}】ルートノード:`);
    for (const node of rootNodes) {
      console.log(`  - ${node.triggerText}`);

      const children = await prisma.scenarioNode.findMany({
        where: { parentId: node.id },
        orderBy: { order: 'asc' },
      });

      for (const child of children) {
        const action = child.action ? ` [${child.action}]` : '';
        console.log(`    → ${child.triggerText}${action}`);
      }
    }
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
