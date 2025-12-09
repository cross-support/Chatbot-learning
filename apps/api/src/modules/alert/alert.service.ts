import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface AlertCondition {
  threshold: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * アラート設定を作成
   */
  async createAlert(data: {
    name: string;
    type: string;
    condition: AlertCondition;
    channels: string[];
    channelConfig?: Record<string, unknown>;
    cooldownMinutes?: number;
  }) {
    return this.prisma.alertConfig.create({
      data: {
        name: data.name,
        type: data.type,
        condition: JSON.parse(JSON.stringify(data.condition)),
        channels: data.channels,
        channelConfig: data.channelConfig as Prisma.InputJsonValue,
        cooldownMinutes: data.cooldownMinutes || 30,
      },
    });
  }

  /**
   * アラート一覧を取得
   */
  async getAlerts() {
    return this.prisma.alertConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * アラートを更新
   */
  async updateAlert(id: string, data: Record<string, unknown>) {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.condition !== undefined) updateData.condition = data.condition;
    if (data.channels !== undefined) updateData.channels = data.channels;
    if (data.channelConfig !== undefined) updateData.channelConfig = data.channelConfig;
    if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
    if (data.cooldownMinutes !== undefined) updateData.cooldownMinutes = data.cooldownMinutes;

    return this.prisma.alertConfig.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * アラートを削除
   */
  async deleteAlert(id: string) {
    return this.prisma.alertConfig.delete({
      where: { id },
    });
  }

  /**
   * アラート条件をチェック
   */
  async checkAlerts() {
    const alerts = await this.prisma.alertConfig.findMany({
      where: { isEnabled: true },
    });

    for (const alert of alerts) {
      // クールダウン期間中はスキップ
      if (alert.lastTriggeredAt) {
        const cooldownEnd = new Date(alert.lastTriggeredAt);
        cooldownEnd.setMinutes(cooldownEnd.getMinutes() + alert.cooldownMinutes);
        if (new Date() < cooldownEnd) continue;
      }

      const value = await this.getMetricValue(alert.type);
      const condition = alert.condition as unknown as AlertCondition;

      if (this.evaluateCondition(value, condition)) {
        await this.triggerAlert(alert, value);
      }
    }
  }

  /**
   * メトリクス値を取得
   */
  private async getMetricValue(type: string): Promise<number> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    switch (type) {
      case 'waiting_queue':
        return this.prisma.conversation.count({
          where: { status: 'WAITING' },
        });

      case 'error_rate':
        const [errors, total] = await Promise.all([
          this.prisma.securityLog.count({
            where: {
              type: { contains: 'error' },
              createdAt: { gte: fiveMinutesAgo },
            },
          }),
          this.prisma.securityLog.count({
            where: { createdAt: { gte: fiveMinutesAgo } },
          }),
        ]);
        return total > 0 ? (errors / total) * 100 : 0;

      case 'webhook_failure_rate':
        const [failed, totalWebhooks] = await Promise.all([
          this.prisma.webhookEventLog.count({
            where: {
              status: { in: ['FAILED', 'EXHAUSTED'] },
              createdAt: { gte: fiveMinutesAgo },
            },
          }),
          this.prisma.webhookEventLog.count({
            where: { createdAt: { gte: fiveMinutesAgo } },
          }),
        ]);
        return totalWebhooks > 0 ? (failed / totalWebhooks) * 100 : 0;

      case 'pending_inquiries':
        return this.prisma.offHoursInquiry.count({
          where: { status: 'PENDING' },
        });

      default:
        return 0;
    }
  }

  /**
   * 条件を評価
   */
  private evaluateCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > condition.threshold;
      case 'lt':
        return value < condition.threshold;
      case 'gte':
        return value >= condition.threshold;
      case 'lte':
        return value <= condition.threshold;
      case 'eq':
        return value === condition.threshold;
      default:
        return false;
    }
  }

  /**
   * アラートを発火
   */
  private async triggerAlert(
    alert: { id: string; name: string; type: string; channels: string[]; channelConfig: unknown },
    value: number,
  ) {
    const message = `[Alert] ${alert.name}: ${alert.type} = ${value}`;
    this.logger.warn(message);

    const notifiedVia: string[] = [];
    const config = alert.channelConfig as Record<string, unknown> | null;

    for (const channel of alert.channels) {
      try {
        if (channel === 'slack' && config?.slackWebhookUrl) {
          await this.sendSlackNotification(config.slackWebhookUrl as string, message);
          notifiedVia.push('slack');
        } else if (channel === 'email' && config?.emailAddresses) {
          await this.sendEmailNotification(config.emailAddresses as string[], message);
          notifiedVia.push('email');
        }
      } catch (error) {
        this.logger.error(`Failed to send ${channel} notification`, error);
      }
    }

    // アラート履歴を記録
    await this.prisma.alertHistory.create({
      data: {
        alertId: alert.id,
        message,
        value,
        notifiedVia,
      },
    });

    // 最終発火時刻を更新
    await this.prisma.alertConfig.update({
      where: { id: alert.id },
      data: { lastTriggeredAt: new Date() },
    });
  }

  /**
   * Slack通知を送信
   */
  private async sendSlackNotification(webhookUrl: string, message: string) {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        username: 'CrossBot Alert',
        icon_emoji: ':warning:',
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status}`);
    }
  }

  /**
   * メール通知を送信（実装は環境に応じて調整）
   */
  private async sendEmailNotification(addresses: string[], message: string) {
    // メール送信の実装（nodemailer等を使用）
    this.logger.log(`Email notification to ${addresses.join(', ')}: ${message}`);
    // 実際の実装では SMTP 設定を使用
  }

  /**
   * アラート履歴を取得
   */
  async getAlertHistory(alertId?: string, limit = 100) {
    return this.prisma.alertHistory.findMany({
      where: alertId ? { alertId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
