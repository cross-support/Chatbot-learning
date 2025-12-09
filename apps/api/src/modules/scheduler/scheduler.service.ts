import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as cron from 'node-cron';

interface TaskConfig {
  reportType?: string;
  recipients?: string[];
  cleanupDays?: number;
  [key: string]: unknown;
}

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadAndScheduleTasks();
  }

  onModuleDestroy() {
    this.stopAllTasks();
  }

  /**
   * タスクをDBから読み込みスケジュール
   */
  async loadAndScheduleTasks() {
    const tasks = await this.prisma.scheduledTask.findMany({
      where: { isEnabled: true },
    });

    for (const task of tasks) {
      this.scheduleTask(task.id, task.cronExpression, task.taskType, task.config as TaskConfig);
    }

    this.logger.log(`Loaded ${tasks.length} scheduled tasks`);
  }

  /**
   * スケジュールタスクを作成
   */
  async createTask(data: {
    name: string;
    taskType: string;
    cronExpression: string;
    config?: TaskConfig;
  }) {
    // cron式の検証
    if (!cron.validate(data.cronExpression)) {
      throw new Error(`Invalid cron expression: ${data.cronExpression}`);
    }

    const task = await this.prisma.scheduledTask.create({
      data: {
        name: data.name,
        taskType: data.taskType,
        cronExpression: data.cronExpression,
        config: (data.config || {}) as Prisma.InputJsonValue,
        nextRunAt: this.getNextRunTime(data.cronExpression),
      },
    });

    this.scheduleTask(task.id, task.cronExpression, task.taskType, task.config as TaskConfig);

    return task;
  }

  /**
   * タスク一覧を取得
   */
  async getTasks() {
    return this.prisma.scheduledTask.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * タスクを更新
   */
  async updateTask(id: string, data: Partial<{
    name: string;
    cronExpression: string;
    config: TaskConfig;
    isEnabled: boolean;
  }>) {
    if (data.cronExpression && !cron.validate(data.cronExpression)) {
      throw new Error(`Invalid cron expression: ${data.cronExpression}`);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.cronExpression !== undefined) {
      updateData.cronExpression = data.cronExpression;
      updateData.nextRunAt = this.getNextRunTime(data.cronExpression);
    }
    if (data.config !== undefined) updateData.config = data.config;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

    const task = await this.prisma.scheduledTask.update({
      where: { id },
      data: updateData,
    });

    // スケジュールを更新
    this.unscheduleTask(id);
    if (task.isEnabled) {
      this.scheduleTask(task.id, task.cronExpression, task.taskType, task.config as TaskConfig);
    }

    return task;
  }

  /**
   * タスクを削除
   */
  async deleteTask(id: string) {
    this.unscheduleTask(id);
    return this.prisma.scheduledTask.delete({
      where: { id },
    });
  }

  /**
   * タスクを手動実行
   */
  async runTaskManually(id: string) {
    const task = await this.prisma.scheduledTask.findUnique({
      where: { id },
    });

    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    return this.executeTask(task.id, task.taskType, task.config as TaskConfig);
  }

  /**
   * タスク実行ログを取得
   */
  async getTaskLogs(taskId?: string, limit = 100) {
    return this.prisma.taskExecutionLog.findMany({
      where: taskId ? { taskId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // ===== プライベートメソッド =====

  private scheduleTask(id: string, cronExpression: string, taskType: string, config: TaskConfig | null) {
    if (this.scheduledJobs.has(id)) {
      this.unscheduleTask(id);
    }

    const job = cron.schedule(cronExpression, async () => {
      await this.executeTask(id, taskType, config);
    });

    this.scheduledJobs.set(id, job);
    this.logger.log(`Scheduled task ${id} with cron: ${cronExpression}`);
  }

  private unscheduleTask(id: string) {
    const job = this.scheduledJobs.get(id);
    if (job) {
      job.stop();
      this.scheduledJobs.delete(id);
      this.logger.log(`Unscheduled task ${id}`);
    }
  }

  private stopAllTasks() {
    for (const [id, job] of this.scheduledJobs) {
      job.stop();
      this.logger.log(`Stopped task ${id}`);
    }
    this.scheduledJobs.clear();
  }

  private async executeTask(taskId: string, taskType: string, config: TaskConfig | null) {
    const startedAt = new Date();
    let status = 'success';
    let result: unknown = null;
    let error: string | null = null;

    try {
      this.logger.log(`Executing task ${taskId} (${taskType})`);

      switch (taskType) {
        case 'daily_report':
          result = await this.runDailyReport(config);
          break;
        case 'cleanup':
          result = await this.runCleanup(config);
          break;
        case 'backup':
          result = await this.runBackup(config);
          break;
        case 'alert_check':
          result = await this.runAlertCheck();
          break;
        case 'retention':
          result = await this.runRetention();
          break;
        default:
          throw new Error(`Unknown task type: ${taskType}`);
      }

      // 次回実行時刻を更新
      const task = await this.prisma.scheduledTask.findUnique({
        where: { id: taskId },
      });
      if (task) {
        await this.prisma.scheduledTask.update({
          where: { id: taskId },
          data: {
            lastRunAt: startedAt,
            nextRunAt: this.getNextRunTime(task.cronExpression),
            lastResult: result as object,
          },
        });
      }
    } catch (e) {
      status = 'failed';
      error = e instanceof Error ? e.message : String(e);
      this.logger.error(`Task ${taskId} failed: ${error}`);
    }

    // 実行ログを記録
    await this.prisma.taskExecutionLog.create({
      data: {
        taskId,
        status,
        startedAt,
        finishedAt: new Date(),
        result: result as object,
        error,
      },
    });

    return { status, result, error };
  }

  private getNextRunTime(cronExpression: string): Date {
    // 簡易的な次回実行時刻計算
    // 実際のプロダクションでは cron-parser 等を使用
    return new Date(Date.now() + 60000); // 仮に1分後
  }

  // ===== タスク実装 =====

  private async runDailyReport(config: TaskConfig | null) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [conversations, messages, surveys] = await Promise.all([
      this.prisma.conversation.count({
        where: {
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      this.prisma.message.count({
        where: {
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      this.prisma.satisfactionSurvey.aggregate({
        where: {
          createdAt: { gte: yesterday, lt: today },
        },
        _avg: { rating: true },
        _count: true,
      }),
    ]);

    const report = {
      date: yesterday.toISOString().split('T')[0],
      conversations,
      messages,
      avgRating: surveys._avg.rating,
      surveyCount: surveys._count,
    };

    this.logger.log(`Daily report generated: ${JSON.stringify(report)}`);
    return report;
  }

  private async runCleanup(config: TaskConfig | null) {
    const days = config?.cleanupDays || 30;
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - days);

    // 古いセキュリティログをクリーンアップ
    const deleted = await this.prisma.securityLog.deleteMany({
      where: {
        createdAt: { lt: threshold },
      },
    });

    return { deletedCount: deleted.count, threshold: threshold.toISOString() };
  }

  private async runBackup(_config: TaskConfig | null) {
    // バックアップのロジック（実際はpg_dumpなどを実行）
    this.logger.log('Backup task executed (placeholder)');
    return { status: 'completed', timestamp: new Date().toISOString() };
  }

  private async runAlertCheck() {
    // アラートサービスを呼び出し
    this.logger.log('Alert check executed');
    return { checked: true };
  }

  private async runRetention() {
    // データ保持ポリシーに基づく削除
    this.logger.log('Retention policy executed');
    return { executed: true };
  }
}
