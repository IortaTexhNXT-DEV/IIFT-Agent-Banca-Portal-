import { Injectable } from '@nestjs/common';
import { notFound } from '../../common/http/errors.js';
import { type PageQueryDto, pageArgs, toPage } from '../../common/http/pagination.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { PermissionCode } from '../../common/security/permissions.js';
import type { NotificationChannel } from '../../generated/prisma/enums.js';

export interface NotificationMessage {
  eventType: string;
  subject: string;
  body: string;
  /** Front-end route the in-app notification links to, e.g. /portal/policies/<id>. */
  link?: string;
  /** Extra channels in addition to the in-app notification. */
  channels?: Extract<NotificationChannel, 'EMAIL' | 'SMS'>[];
  attachmentIds?: string[];
  /** Body contains a secret (e.g. temporary password); it is erased once delivered. */
  sensitive?: boolean;
}

/**
 * Common notification framework (COM-05, AP-34, AP-54). Messages are written in the
 * same transaction as the business change that triggered them, then email/SMS copies
 * are delivered asynchronously by NotificationDispatcher with retries.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyUser(db: Db, userId: string, message: NotificationMessage): Promise<void> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, mobile: true, status: true },
    });
    if (!user || user.status === 'DISABLED') {
      return;
    }
    const rows: { channel: NotificationChannel; recipient: string }[] = [
      { channel: 'IN_APP', recipient: user.id },
    ];
    if (message.channels?.includes('EMAIL') && user.email)
      rows.push({ channel: 'EMAIL', recipient: user.email });
    if (message.channels?.includes('SMS') && user.mobile)
      rows.push({ channel: 'SMS', recipient: user.mobile });

    await db.notification.createMany({
      data: rows.map((row) => ({
        userId: user.id,
        channel: row.channel,
        recipient: row.recipient,
        eventType: message.eventType,
        subject: message.subject,
        body: message.body,
        link: message.link,
        attachmentIds: message.attachmentIds ?? [],
        status: row.channel === 'IN_APP' ? 'SENT' : 'PENDING',
        sentAt: row.channel === 'IN_APP' ? new Date() : null,
      })),
    });
  }

  async notifyAgent(db: Db, agentId: string, message: NotificationMessage): Promise<void> {
    const user = await db.user.findUnique({ where: { agentId }, select: { id: true } });
    if (user) {
      await this.notifyUser(db, user.id, message);
    }
  }

  async notifyAgencyUsers(db: Db, agencyId: string, message: NotificationMessage): Promise<void> {
    const users = await db.user.findMany({
      where: { agent: { agencyId, status: 'ACTIVE' }, status: { not: 'DISABLED' } },
      select: { id: true },
    });
    for (const user of users) {
      await this.notifyUser(db, user.id, message);
    }
  }

  /** Notifies every active back-office user holding `permission` (e.g. the approvers of a step). */
  async notifyPermissionHolders(
    db: Db,
    permission: PermissionCode,
    message: NotificationMessage,
    excludeUserId?: string,
  ): Promise<void> {
    const users = await db.user.findMany({
      where: {
        status: 'ACTIVE',
        userType: 'STAFF',
        id: excludeUserId ? { not: excludeUserId } : undefined,
        roles: { some: { role: { permissions: { some: { permission } } } } },
      },
      select: { id: true },
    });
    for (const user of users) {
      await this.notifyUser(db, user.id, message);
    }
  }

  /** Email to someone who is not a system user, e.g. a participant receiving policy documents. */
  async emailExternal(
    db: Db,
    email: string,
    message: Omit<NotificationMessage, 'channels' | 'link'>,
  ): Promise<void> {
    await db.notification.create({
      data: {
        channel: 'EMAIL',
        recipient: email,
        eventType: message.eventType,
        subject: message.subject,
        body: message.body,
        attachmentIds: message.attachmentIds ?? [],
        sensitive: message.sensitive ?? false,
      },
    });
  }

  async listForUser(userId: string, query: PageQueryDto, unreadOnly: boolean) {
    const where = { userId, channel: 'IN_APP' as const, readAt: unreadOnly ? null : undefined };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          eventType: true,
          subject: true,
          body: true,
          link: true,
          readAt: true,
          createdAt: true,
        },
        ...pageArgs(query),
      }),
      this.prisma.notification.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({ where: { userId, channel: 'IN_APP', readAt: null } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    });
    if (
      result.count === 0 &&
      !(await this.prisma.notification.findFirst({ where: { id, userId } }))
    ) {
      throw notFound('Notification');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, channel: 'IN_APP', readAt: null },
      data: { readAt: new Date() },
    });
  }
}
