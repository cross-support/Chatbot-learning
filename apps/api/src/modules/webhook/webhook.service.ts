import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, url: string, events: string[], secret?: string) {
    const webhook = await this.prisma.webhook.create({
      data: {
        name,
        url,
        events,
        secret,
      },
    });

    this.logger.log(`Webhook created: ${name} (${webhook.id})`);

    return webhook;
  }

  async findAll() {
    return this.prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id },
    });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    return webhook;
  }

  async update(
    id: string,
    data: {
      name?: string;
      url?: string;
      events?: string[];
      secret?: string;
      isActive?: boolean;
    },
  ) {
    const webhook = await this.prisma.webhook.update({
      where: { id },
      data,
    });

    this.logger.log(`Webhook updated: ${webhook.name} (${id})`);

    return webhook;
  }

  async remove(id: string) {
    await this.prisma.webhook.delete({
      where: { id },
    });

    this.logger.log(`Webhook deleted: ${id}`);

    return { message: 'Webhook deleted successfully' };
  }

  async getLogs(webhookId: string, limit: number = 100) {
    return this.prisma.webhookEventLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Webhookイベントディスパッチ
   */
  async dispatch(event: string, payload: any) {
    // 対象のWebhook取得
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event,
        },
      },
    });

    if (webhooks.length === 0) {
      this.logger.debug(`No active webhooks for event: ${event}`);
      return;
    }

    // 各Webhookに対して送信
    for (const webhook of webhooks) {
      await this.sendWebhook(webhook.id, event, payload);
    }
  }

  /**
   * Webhook送信
   */
  private async sendWebhook(webhookId: string, event: string, payload: any) {
    const webhook = await this.findOne(webhookId);

    // イベントログ作成
    const eventLog = await this.prisma.webhookEventLog.create({
      data: {
        webhookId,
        event,
        payload,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: 5,
      },
    });

    try {
      // 署名生成
      const signature = webhook.secret
        ? this.generateSignature(payload, webhook.secret)
        : undefined;

      // HTTP送信
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature || '',
          'X-Webhook-Event': event,
        },
        body: JSON.stringify(payload),
      });

      const responseBody = await response.text();

      if (response.ok) {
        // 成功
        await this.prisma.webhookEventLog.update({
          where: { id: eventLog.id },
          data: {
            status: 'SUCCESS',
            attempts: 1,
            responseCode: response.status,
            responseBody,
            sentAt: new Date(),
          },
        });

        await this.prisma.webhook.update({
          where: { id: webhookId },
          data: { lastTriggeredAt: new Date() },
        });

        this.logger.log(`Webhook sent successfully: ${webhook.name} (${event})`);
      } else {
        // 失敗（リトライ設定）
        const nextRetry = new Date(Date.now() + 5 * 60 * 1000); // 5分後
        await this.prisma.webhookEventLog.update({
          where: { id: eventLog.id },
          data: {
            status: 'FAILED',
            attempts: 1,
            responseCode: response.status,
            responseBody,
            lastError: `HTTP ${response.status}: ${responseBody}`,
            nextRetryAt: nextRetry,
          },
        });

        this.logger.warn(`Webhook failed: ${webhook.name} (${event}) - ${response.status}`);
      }
    } catch (error) {
      // エラー
      const nextRetry = new Date(Date.now() + 5 * 60 * 1000); // 5分後
      await this.prisma.webhookEventLog.update({
        where: { id: eventLog.id },
        data: {
          status: 'FAILED',
          attempts: 1,
          lastError: error instanceof Error ? error.message : String(error),
          nextRetryAt: nextRetry,
        },
      });

      this.logger.error(`Webhook error: ${webhook.name} (${event})`, error instanceof Error ? error.stack : String(error));
    }
  }

  /**
   * HMAC-SHA256署名生成
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * リトライ処理
   */
  async retryFailedWebhooks() {
    const now = new Date();
    const failedLogs = await this.prisma.webhookEventLog.findMany({
      where: {
        status: 'FAILED',
        attempts: {
          lt: 5, // maxAttempts未満
        },
        nextRetryAt: {
          lte: now,
        },
      },
      take: 100,
    });

    for (const log of failedLogs) {
      await this.retryWebhook(log.id);
    }
  }

  private async retryWebhook(eventLogId: string) {
    const log = await this.prisma.webhookEventLog.findUnique({
      where: { id: eventLogId },
    });

    if (!log) return;

    const webhook = await this.findOne(log.webhookId);

    try {
      const signature = webhook.secret
        ? this.generateSignature(log.payload, webhook.secret)
        : undefined;

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature || '',
          'X-Webhook-Event': log.event,
        },
        body: JSON.stringify(log.payload),
      });

      const responseBody = await response.text();

      if (response.ok) {
        await this.prisma.webhookEventLog.update({
          where: { id: eventLogId },
          data: {
            status: 'SUCCESS',
            attempts: log.attempts + 1,
            responseCode: response.status,
            responseBody,
            sentAt: new Date(),
          },
        });

        this.logger.log(`Webhook retry successful: ${webhook.name} (${log.event})`);
      } else {
        const isExhausted = log.attempts + 1 >= log.maxAttempts;
        const nextRetry = isExhausted
          ? null
          : new Date(Date.now() + Math.pow(2, log.attempts) * 5 * 60 * 1000); // 指数バックオフ

        await this.prisma.webhookEventLog.update({
          where: { id: eventLogId },
          data: {
            status: isExhausted ? 'EXHAUSTED' : 'FAILED',
            attempts: log.attempts + 1,
            responseCode: response.status,
            responseBody,
            lastError: `HTTP ${response.status}: ${responseBody}`,
            nextRetryAt: nextRetry,
          },
        });

        this.logger.warn(
          `Webhook retry failed: ${webhook.name} (${log.event}) - attempt ${log.attempts + 1}`,
        );
      }
    } catch (error) {
      const isExhausted = log.attempts + 1 >= log.maxAttempts;
      const nextRetry = isExhausted
        ? null
        : new Date(Date.now() + Math.pow(2, log.attempts) * 5 * 60 * 1000);

      await this.prisma.webhookEventLog.update({
        where: { id: eventLogId },
        data: {
          status: isExhausted ? 'EXHAUSTED' : 'FAILED',
          attempts: log.attempts + 1,
          lastError: error instanceof Error ? error.message : String(error),
          nextRetryAt: nextRetry,
        },
      });

      this.logger.error(`Webhook retry error: ${webhook.name} (${log.event})`, error instanceof Error ? error.stack : String(error));
    }
  }
}
