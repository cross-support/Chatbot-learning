import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupDir: string;

  constructor(private prisma: PrismaService) {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDir();
  }

  private ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * データベースのバックアップを作成
   */
  async createBackup(): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);

    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new BadRequestException('DATABASE_URL が設定されていません');
      }

      // pg_dump コマンドを実行
      const command = `pg_dump "${databaseUrl}" > "${filepath}"`;
      await execAsync(command);

      const stats = fs.statSync(filepath);

      this.logger.log(`Backup created: ${filename} (${stats.size} bytes)`);

      return {
        filename,
        size: stats.size,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Backup failed', error);
      // ファイルが作成されていたら削除
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      throw new BadRequestException('バックアップの作成に失敗しました');
    }
  }

  /**
   * バックアップ一覧を取得
   */
  async listBackups(): Promise<BackupInfo[]> {
    this.ensureBackupDir();

    const files = fs.readdirSync(this.backupDir);
    const backups: BackupInfo[] = [];

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filepath = path.join(this.backupDir, file);
        const stats = fs.statSync(filepath);
        backups.push({
          filename: file,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
        });
      }
    }

    return backups.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * バックアップをダウンロード
   */
  getBackupPath(filename: string): string {
    const filepath = path.join(this.backupDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new BadRequestException('バックアップファイルが見つかりません');
    }

    // ディレクトリトラバーサル対策
    const realPath = fs.realpathSync(filepath);
    if (!realPath.startsWith(fs.realpathSync(this.backupDir))) {
      throw new BadRequestException('無効なファイルパスです');
    }

    return filepath;
  }

  /**
   * バックアップからリストア
   */
  async restoreBackup(filename: string): Promise<void> {
    const filepath = this.getBackupPath(filename);

    try {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        throw new BadRequestException('DATABASE_URL が設定されていません');
      }

      // psql コマンドでリストア
      const command = `psql "${databaseUrl}" < "${filepath}"`;
      await execAsync(command);

      this.logger.log(`Restored from backup: ${filename}`);
    } catch (error) {
      this.logger.error('Restore failed', error);
      throw new BadRequestException('リストアに失敗しました');
    }
  }

  /**
   * バックアップを削除
   */
  async deleteBackup(filename: string): Promise<void> {
    const filepath = this.getBackupPath(filename);
    fs.unlinkSync(filepath);
    this.logger.log(`Deleted backup: ${filename}`);
  }

  /**
   * 古いバックアップを自動削除（デフォルト30日以上）
   */
  async cleanupOldBackups(days: number = 30): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const backups = await this.listBackups();
    let deleted = 0;

    for (const backup of backups) {
      if (new Date(backup.createdAt).getTime() < cutoff) {
        await this.deleteBackup(backup.filename);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * データのエクスポート（JSON形式）
   */
  async exportData(tables: string[]): Promise<Record<string, unknown[]>> {
    const result: Record<string, unknown[]> = {};

    for (const table of tables) {
      try {
        switch (table) {
          case 'users':
            result.users = await this.prisma.user.findMany();
            break;
          case 'conversations':
            result.conversations = await this.prisma.conversation.findMany({
              include: { messages: true },
            });
            break;
          case 'scenarios':
            result.scenarios = await this.prisma.scenario.findMany({
              include: { nodes: true },
            });
            break;
          case 'templates':
            result.templates = await this.prisma.template.findMany();
            break;
          case 'admins':
            result.admins = await this.prisma.admin.findMany({
              select: {
                id: true,
                email: true,
                name: true,
                role: true,
                status: true,
                createdAt: true,
              },
            });
            break;
        }
      } catch (error) {
        this.logger.warn(`Failed to export table: ${table}`, error);
      }
    }

    return result;
  }
}
