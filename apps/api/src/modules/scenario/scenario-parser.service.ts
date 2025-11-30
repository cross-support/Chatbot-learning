import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import { ScenarioAction } from '@prisma/client';

interface ParsedCell {
  text: string;
  action?: ScenarioAction;
  actionValue?: string;
}

interface CsvRow {
  Level1?: string;
  Level2?: string;
  Level3?: string;
  Level4?: string;
  Level5?: string;
  Level6?: string;
  Level7?: string;
  Level8?: string;
  Level9?: string;
  Level10?: string;
  TransitionCount?: string;
}

@Injectable()
export class ScenarioParserService {
  constructor(private prisma: PrismaService) {}

  /**
   * CSVファイルをパースしてデータベースにインポート
   */
  async importFromCsv(csvContent: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      // CSVをパース
      const records: CsvRow[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });

      // 既存のシナリオを削除
      await this.prisma.scenarioNode.deleteMany({});

      // ノードマップ（キー: レベル+テキスト、値: ノードID）
      const nodeMap = new Map<string, number>();

      // 各行を処理
      for (let rowIndex = 0; rowIndex < records.length; rowIndex++) {
        const row = records[rowIndex];
        let currentParentId: number | null = null;

        // Level1からLevel10まで処理
        for (let level = 1; level <= 10; level++) {
          const cellValue = row[`Level${level}` as keyof CsvRow];
          if (!cellValue || cellValue.trim() === '') continue;

          const parsed = this.parseCell(cellValue);
          const nodeKey = this.generateNodeKey(level, parsed.text, currentParentId);

          // 既存のノードを確認
          let nodeId = nodeMap.get(nodeKey);

          if (nodeId === undefined) {
            // 新規ノードを作成
            try {
              const createdNode: { id: number } = await this.prisma.scenarioNode.create({
                data: {
                  parentId: currentParentId,
                  level,
                  triggerText: parsed.text,
                  responseText: this.generateResponse(parsed),
                  action: parsed.action,
                  actionValue: parsed.actionValue,
                  order: imported,
                },
              });
              nodeId = createdNode.id;
              nodeMap.set(nodeKey, createdNode.id);
              imported++;
            } catch (error) {
              errors.push(`行 ${rowIndex + 1}: ノード作成エラー - ${error}`);
              continue;
            }
          }

          currentParentId = nodeId ?? null;
        }
      }

      return { imported, errors };
    } catch (error) {
      throw new BadRequestException(`CSVパースエラー: ${error}`);
    }
  }

  /**
   * セル内のテキストを解析
   */
  private parseCell(cell: string): ParsedCell {
    // [link]URL パターン
    const linkMatch = cell.match(/(.+?)\[link\](.+)/i);
    if (linkMatch) {
      return {
        text: linkMatch[1].trim(),
        action: 'LINK',
        actionValue: linkMatch[2].trim(),
      };
    }

    // [handover] パターン
    if (cell.toLowerCase().includes('[handover]') || cell.includes('オペレーターにつなぐ')) {
      return {
        text: cell.replace(/\[handover\]/i, '').trim(),
        action: 'HANDOVER',
      };
    }

    // [form]ID パターン
    const formMatch = cell.match(/(.+?)\[form\](.+)/i);
    if (formMatch) {
      return {
        text: formMatch[1].trim(),
        action: 'FORM',
        actionValue: formMatch[2].trim(),
      };
    }

    // はじめに戻る / HOME_BUTTON パターン
    if (cell.includes('はじめに戻る') || cell.includes('HOME_BUTTON')) {
      return {
        text: cell.replace('HOME_BUTTON_PRESSED', 'はじめに戻る').trim(),
        action: 'RESTART',
      };
    }

    // 離脱 / drop_off パターン
    if (cell.toLowerCase().includes('drop_off') || cell.includes('離脱')) {
      return {
        text: cell.replace(/drop_off/i, '').replace('離脱:', '').trim() || '離脱',
        action: 'DROP_OFF',
      };
    }

    return { text: cell.trim() };
  }

  /**
   * ノードキーを生成（重複チェック用）
   */
  private generateNodeKey(level: number, text: string, parentId: number | null): string {
    return `${level}:${parentId}:${text}`;
  }

  /**
   * レスポンステキストを生成
   */
  private generateResponse(parsed: ParsedCell): string | undefined {
    if (parsed.action === 'LINK') {
      return `${parsed.text}の詳細については、以下のリンクをご確認ください。`;
    }
    if (parsed.action === 'HANDOVER') {
      return '担当者にお繋ぎします。少々お待ちください。';
    }
    if (parsed.action === 'FORM') {
      return 'こちらのフォームに必要事項をご入力ください。';
    }
    return undefined;
  }

  /**
   * データベースからCSVにエクスポート
   */
  async exportToCsv(): Promise<string> {
    const nodes = await this.prisma.scenarioNode.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { order: 'asc' }],
    });

    // ツリーを平坦化してCSV形式に変換
    const rows: string[][] = [];
    const header = ['Level1', 'Level2', 'Level3', 'Level4', 'Level5', 'Level6', 'Level7', 'Level8', 'Level9', 'Level10', 'TransitionCount'];
    rows.push(header);

    // ツリー構造を構築
    type NodeType = typeof nodes[0];
    interface NodeWithChildren extends NodeType {
      children: NodeWithChildren[];
    }

    const nodeMap = new Map<number, NodeWithChildren>();
    const rootNodes: NodeWithChildren[] = [];

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

    // 再帰的にCSV行を生成
    const generateRows = (node: NodeWithChildren, path: string[]): void => {
      const cellText = this.formatCellForExport(node);
      const newPath = [...path, cellText];

      if (node.children.length === 0) {
        const row = new Array(11).fill('');
        newPath.forEach((text, i) => {
          if (i < 10) row[i] = text;
        });
        rows.push(row);
      } else {
        node.children.forEach((child) => {
          generateRows(child, newPath);
        });
      }
    };

    rootNodes.forEach((root) => {
      generateRows(root, []);
    });

    // CSV文字列に変換
    return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  }

  /**
   * エクスポート用にセルをフォーマット
   */
  private formatCellForExport(node: { triggerText: string; action: ScenarioAction | null; actionValue: string | null }): string {
    let text = node.triggerText;

    if (node.action === 'LINK' && node.actionValue) {
      text = `${text}[link]${node.actionValue}`;
    } else if (node.action === 'HANDOVER') {
      text = `${text}[handover]`;
    } else if (node.action === 'FORM' && node.actionValue) {
      text = `${text}[form]${node.actionValue}`;
    }

    return text;
  }
}
