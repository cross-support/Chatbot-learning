import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebhookLogStatus } from '@prisma/client';
import * as crypto from 'crypto';

export type WebhookEvent =
  | 'conversation.created'
  | 'conversation.closed'
  | 'conversation.assigned'
  | 'message.received'
  | 'message.sent'
  | 'user.created';

// リトライ間隔（ミリ秒）: 1分、5分、15分、30分、1時間
const RETRY_DELAYS = [60000, 300000, 900000, 1800000, 3600000];
const REQUEST_TIMEOUT = 10000; // 10秒

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private prisma: PrismaService) {}

  private generateSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async create(name: string, url: string, events: string[]) {
    const secret = this.generateSecret();

    return this.prisma.webhook.create({
      data: {
        name,
        url,
        events,
        secret,
      },
    });
  }

  async findAll() {
    return this.prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      throw new NotFoundException('Webhookが見つかりません');
    }

    return webhook;
  }

  async update(id: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) {
    await this.findById(id); // 存在確認

    return this.prisma.webhook.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.findById(id); // 存在確認
    await this.prisma.webhook.delete({ where: { id } });
    return { success: true };
  }

  async regenerateSecret(id: string) {
    await this.findById(id); // 存在確認
    const secret = this.generateSecret();

    return this.prisma.webhook.update({
      where: { id },
      data: { secret },
    });
  }

  async trigger(event: WebhookEvent, payload: Record<string, unknown>) {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    });

    // 各Webhookに対してイベントログを作成し、送信を試行
    const results = await Promise.allSettled(
      webhooks.map(async (webhook) => {
        // イベントログを作成
        const eventLog = await this.prisma.webhookEventLog.create({
          data: {
            webhookId: webhook.id,
            event,
            payload: payload as object,
            status: 'PENDING',
          },
        });

        // 即時送信を試行
        return this.sendWebhookWithLog(webhook, eventLog.id);
      })
    );

    return results;
  }

  private async sendWebhookWithLog(
    webhook: { id: string; url: string; secret: string | null },
    eventLogId: string
  ) {
    const eventLog = await this.prisma.webhookEventLog.findUnique({
      where: { id: eventLogId },
    });

    if (!eventLog) return { success: false, error: 'Event log not found' };

    try {
      const timestamp = Date.now().toString();
      const body = JSON.stringify({
        event: eventLog.event,
        timestamp,
        payload: eventLog.payload,
      });

      // 署名を生成
      const signature = webhook.secret
        ? crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')
        : undefined;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': eventLog.event,
          'X-Webhook-Timestamp': timestamp,
          ...(signature && { 'X-Webhook-Signature': `sha256=${signature}` }),
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        // 成功
        await this.prisma.webhookEventLog.update({
          where: { id: eventLogId },
          data: {
            status: 'SUCCESS',
            attempts: eventLog.attempts + 1,
            responseCode: response.status,
            responseBody: responseBody.slice(0, 1000),
            sentAt: new Date(),
          },
        });

        await this.prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date() },
        });

        return { webhookId: webhook.id, success: true, status: response.status };
      } else {
        // 失敗 - リトライをスケジュール
        return this.scheduleRetry(webhook.id, eventLogId, eventLog.attempts + 1, `HTTP ${response.status}`, response.status);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook send failed: ${webhook.id}`, error);
      return this.scheduleRetry(webhook.id, eventLogId, (eventLog?.attempts || 0) + 1, errorMessage);
    }
  }

  private async scheduleRetry(
    webhookId: string,
    eventLogId: string,
    attempts: number,
    errorMessage: string,
    responseCode?: number
  ) {
    const maxAttempts = RETRY_DELAYS.length + 1;

    if (attempts >= maxAttempts) {
      // リトライ上限到達
      await this.prisma.webhookEventLog.update({
        where: { id: eventLogId },
        data: {
          status: 'EXHAUSTED',
          attempts,
          lastError: errorMessage,
          responseCode,
        },
      });
      return { webhookId, success: false, error: 'Max retries exceeded' };
    }

    // 次のリトライ時間を計算
    const delay = RETRY_DELAYS[attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
    const nextRetryAt = new Date(Date.now() + delay);

    await this.prisma.webhookEventLog.update({
      where: { id: eventLogId },
      data: {
        status: 'FAILED',
        attempts,
        lastError: errorMessage,
        responseCode,
        nextRetryAt,
      },
    });

    return { webhookId, success: false, error: errorMessage, nextRetryAt };
  }

  // 失敗したWebhookを再送信（定期実行用）
  async processRetries() {
    const pendingRetries = await this.prisma.webhookEventLog.findMany({
      where: {
        status: 'FAILED',
        nextRetryAt: { lte: new Date() },
      },
      take: 50,
    });

    const results = await Promise.allSettled(
      pendingRetries.map(async (log) => {
        const webhook = await this.prisma.webhook.findUnique({
          where: { id: log.webhookId },
        });

        if (!webhook || !webhook.isActive) {
          await this.prisma.webhookEventLog.update({
            where: { id: log.id },
            data: { status: 'EXHAUSTED', lastError: 'Webhook disabled or deleted' },
          });
          return { success: false };
        }

        return this.sendWebhookWithLog(webhook, log.id);
      })
    );

    return results.filter((r) => r.status === 'fulfilled').length;
  }

  // イベントログの取得
  async getEventLogs(params: {
    webhookId?: string;
    status?: WebhookLogStatus;
    limit?: number;
    offset?: number;
  }) {
    const { webhookId, status, limit = 50, offset = 0 } = params;

    const where: Record<string, unknown> = {};
    if (webhookId) where.webhookId = webhookId;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      this.prisma.webhookEventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.webhookEventLog.count({ where }),
    ]);

    return { logs, total };
  }

  // 手動再送信
  async retryEvent(eventLogId: string) {
    const log = await this.prisma.webhookEventLog.findUnique({
      where: { id: eventLogId },
    });

    if (!log) throw new NotFoundException('イベントログが見つかりません');

    const webhook = await this.prisma.webhook.findUnique({
      where: { id: log.webhookId },
    });

    if (!webhook) throw new NotFoundException('Webhookが見つかりません');

    // 手動再送信時はattemptをリセット
    await this.prisma.webhookEventLog.update({
      where: { id: eventLogId },
      data: { status: 'PENDING', attempts: 0, nextRetryAt: null },
    });

    return this.sendWebhookWithLog(webhook, eventLogId);
  }

  // 古いログのクリーンアップ
  async cleanupOldLogs(days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await this.prisma.webhookEventLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(`Cleaned up ${result.count} old webhook logs`);
    return result.count;
  }

  async testWebhook(id: string) {
    const webhook = await this.findById(id);

    try {
      const timestamp = Date.now().toString();
      const body = JSON.stringify({
        event: 'test',
        timestamp,
        payload: { message: 'Webhookテストです' },
      });

      const signature = webhook.secret
        ? crypto.createHmac('sha256', webhook.secret).update(body).digest('hex')
        : undefined;

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'test',
          'X-Webhook-Timestamp': timestamp,
          ...(signature && { 'X-Webhook-Signature': `sha256=${signature}` }),
        },
        body,
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  getAvailableEvents(): { event: WebhookEvent; description: string }[] {
    return [
      { event: 'conversation.created', description: '新しい会話が開始された' },
      { event: 'conversation.closed', description: '会話が終了した' },
      { event: 'conversation.assigned', description: '会話がオペレーターにアサインされた' },
      { event: 'message.received', description: 'ユーザーからメッセージを受信した' },
      { event: 'message.sent', description: 'オペレーター/ボットがメッセージを送信した' },
      { event: 'user.created', description: '新しいユーザーが作成された' },
    ];
  }
}
