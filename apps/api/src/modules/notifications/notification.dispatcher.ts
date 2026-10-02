import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Notification } from '../../generated/prisma/client.js';
import { DocumentStorage } from '../documents/document-storage.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import { type EmailAttachment, EmailChannel, SmsChannel } from './channels.js';

const BATCH_SIZE = 50;

/** Delivers pending email/SMS notifications with retry, logging each attempt. */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly email: EmailChannel,
    private readonly sms: SmsChannel,
    private readonly storage: DocumentStorage,
  ) {}

  @Interval('notification-dispatch', 30_000)
  async scheduledRun(): Promise<void> {
    if (!this.config.jobs.enabled) {
      return;
    }
    await this.prisma.withJobLock('notification-dispatch', () => this.dispatchPending());
  }

  async dispatchPending(): Promise<void> {
    const maxAttempts = await this.settings.getInt(Setting.NotificationMaxAttempts);
    const pending = await this.prisma.notification.findMany({
      where: {
        status: 'PENDING',
        channel: { in: ['EMAIL', 'SMS'] },
        attempts: { lt: maxAttempts },
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });
    for (const notification of pending) {
      await this.deliver(notification, maxAttempts);
    }
  }

  private async deliver(notification: Notification, maxAttempts: number): Promise<void> {
    const started = Date.now();
    const system = notification.channel === 'EMAIL' ? 'EMAIL' : 'SMS';
    try {
      const result =
        notification.channel === 'EMAIL'
          ? await this.email.send(
              notification.recipient,
              notification.subject,
              notification.body,
              await this.attachments(notification),
            )
          : await this.sms.send(
              notification.recipient,
              `${notification.subject}: ${notification.body}`.slice(0, 480),
            );
      await this.prisma.$transaction([
        this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            attempts: { increment: 1 },
            lastError: null,
            body: notification.sensitive ? '[Content removed after delivery]' : undefined,
          },
        }),
        this.prisma.integrationLog.create({
          data: {
            system,
            operation: notification.eventType,
            direction: 'OUTBOUND',
            success: true,
            durationMs: Date.now() - started,
            reference: result.reference ?? (result.simulated ? 'NOT_CONFIGURED' : null),
            requestSummary: `Notification ${notification.id}`,
          },
        }),
      ]);
    } catch (error) {
      const message = (error as Error).message.slice(0, 1000);
      const attempts = notification.attempts + 1;
      this.logger.warn(
        `Notification ${notification.id} delivery failed (attempt ${attempts}): ${message}`,
      );
      await this.prisma.$transaction([
        this.prisma.notification.update({
          where: { id: notification.id },
          data: {
            attempts,
            lastError: message,
            status: attempts >= maxAttempts ? 'FAILED' : 'PENDING',
          },
        }),
        this.prisma.integrationLog.create({
          data: {
            system,
            operation: notification.eventType,
            direction: 'OUTBOUND',
            success: false,
            durationMs: Date.now() - started,
            requestSummary: `Notification ${notification.id}`,
            errorMessage: message,
          },
        }),
      ]);
    }
  }

  private async attachments(notification: Notification): Promise<EmailAttachment[]> {
    if (notification.attachmentIds.length === 0) {
      return [];
    }
    const documents = await this.prisma.document.findMany({
      where: { id: { in: notification.attachmentIds } },
    });
    return Promise.all(
      documents.map(async (document) => ({
        filename: document.fileName,
        contentType: document.mimeType,
        content: await this.storage.read(document.storageKey),
      })),
    );
  }
}
