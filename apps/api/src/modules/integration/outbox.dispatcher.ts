import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Permission } from '../../common/security/permissions.js';
import type { OutboxMessage } from '../../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import {
  CoreSystemGateway,
  type DeliveryReceipt,
  FinanceGateway,
  IntegrationError,
} from './gateways.js';

const BATCH_SIZE = 25;
const MAX_BACKOFF_MINUTES = 60;

/**
 * Delivers outbox messages to the Core and Finance systems (INT-13/14). Failures are
 * retried with exponential back-off; after the configured number of attempts the
 * message is moved to dead-letter and the integration support team is alerted.
 */
@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly core: CoreSystemGateway,
    private readonly finance: FinanceGateway,
    private readonly notifications: NotificationsService,
  ) {}

  @Interval('outbox-dispatch', 20_000)
  async scheduledRun(): Promise<void> {
    if (!this.config.jobs.enabled) {
      return;
    }
    await this.prisma.withJobLock('outbox-dispatch', () => this.dispatchDue());
  }

  async dispatchDue(): Promise<void> {
    const due = await this.prisma.outboxMessage.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] }, nextAttemptAt: { lte: new Date() } },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });
    for (const message of due) {
      await this.deliver(message);
    }
  }

  private async deliver(message: OutboxMessage): Promise<void> {
    const started = Date.now();
    try {
      const receipt = await this.send(message);
      await this.prisma.$transaction([
        this.prisma.outboxMessage.update({
          where: { id: message.id },
          data: {
            status: 'SENT',
            attempts: { increment: 1 },
            processedAt: new Date(),
            lastError: null,
          },
        }),
        this.prisma.integrationLog.create({
          data: {
            system: message.system,
            operation: message.operation,
            direction: 'OUTBOUND',
            success: true,
            durationMs: Date.now() - started,
            reference: receipt.simulated ? `${receipt.reference} (simulated)` : receipt.reference,
            requestSummary: `${message.aggregateType ?? ''} ${message.aggregateId ?? ''}`.trim(),
            outboxId: message.id,
          },
        }),
      ]);
    } catch (error) {
      await this.recordFailure(message, error as Error, Date.now() - started);
    }
  }

  private send(message: OutboxMessage): Promise<DeliveryReceipt> {
    // The outbox id doubles as idempotency key so the receiver can ignore duplicates.
    switch (message.system) {
      case 'CORE':
        return this.core.deliver(message.operation, message.payload, message.id);
      case 'FINANCE':
        return this.finance.deliver(message.operation, message.payload, message.id);
      default:
        throw new IntegrationError(`No gateway for ${message.system}`, false);
    }
  }

  private async recordFailure(
    message: OutboxMessage,
    error: Error,
    durationMs: number,
  ): Promise<void> {
    const maxAttempts = await this.settings.getInt(Setting.IntegrationMaxAttempts);
    const attempts = message.attempts + 1;
    const retryable = !(error instanceof IntegrationError) || error.retryable;
    const dead = !retryable || attempts >= maxAttempts;
    const backoffMinutes = Math.min(2 ** (attempts - 1), MAX_BACKOFF_MINUTES);
    this.logger.warn(
      `Outbox ${message.id} ${message.system}/${message.operation} failed (attempt ${attempts}): ${error.message}`,
    );

    await this.prisma.$transaction(async (tx) => {
      await tx.outboxMessage.update({
        where: { id: message.id },
        data: {
          attempts,
          status: dead ? 'DEAD' : 'FAILED',
          lastError: error.message.slice(0, 1000),
          nextAttemptAt: new Date(Date.now() + backoffMinutes * 60_000),
        },
      });
      await tx.integrationLog.create({
        data: {
          system: message.system,
          operation: message.operation,
          direction: 'OUTBOUND',
          success: false,
          durationMs,
          requestSummary: `${message.aggregateType ?? ''} ${message.aggregateId ?? ''}`.trim(),
          errorMessage: error.message.slice(0, 1000),
          outboxId: message.id,
        },
      });
      if (dead) {
        await this.notifications.notifyPermissionHolders(tx, Permission.BoIntegrationManage, {
          eventType: 'INTEGRATION_DEAD_LETTER',
          subject: `Integration failure: ${message.system} ${message.operation}`,
          body: `Message ${message.id} could not be delivered after ${attempts} attempt(s): ${error.message}`,
          link: '/backoffice/integration',
          channels: ['EMAIL'],
        });
      }
    });
  }
}
