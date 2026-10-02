import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfig } from '../../config/app-config.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { BUSINESS_TIME_ZONE, businessToday } from '../../common/util/dates.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';

/**
 * AP-42: when an issued policy's contribution has not been submitted within the grace
 * period (7 days by default), every agent of that agency/bank is blocked from issuing
 * new business. The block lifts automatically once nothing is overdue.
 */
@Injectable()
export class GracePeriodService {
  private readonly logger = new Logger(GracePeriodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Cron('0 0 1 * * *', { name: 'payment-grace-period', timeZone: BUSINESS_TIME_ZONE })
  async scheduledRun(): Promise<void> {
    if (!this.config.jobs.enabled) {
      return;
    }
    await this.prisma.withJobLock('payment-grace-period', () => this.evaluateAll());
  }

  async evaluateAll(): Promise<void> {
    const agencies = await this.prisma.agency.findMany({ select: { id: true } });
    for (const agency of agencies) {
      await this.prisma.$transaction((tx) => this.evaluateAgency(tx, agency.id));
    }
  }

  async evaluateAgency(db: Db, agencyId: string): Promise<void> {
    const agency = await db.agency.findUniqueOrThrow({ where: { id: agencyId } });
    const overdue = await db.policy.aggregate({
      where: {
        agencyId,
        status: 'ACTIVE',
        paymentStatus: 'UNPAID',
        paymentDueDate: { lt: businessToday() },
      },
      _count: { _all: true },
      _sum: { outstandingAmount: true },
    });
    const overdueCount = overdue._count._all;

    if (overdueCount > 0 && !agency.issuanceBlocked) {
      const graceDays = await this.settings.getInt(Setting.PaymentGraceDays);
      const reason = `${overdueCount} policy(ies) with contribution not submitted within ${graceDays} days (B$${overdue._sum.outstandingAmount?.toFixed(2)})`;
      await db.agency.update({
        where: { id: agencyId },
        data: { issuanceBlocked: true, issuanceBlockedAt: new Date(), issuanceBlockReason: reason },
      });
      await this.audit.record(
        { action: 'AGENCY_BLOCKED', entityType: 'Agency', entityId: agencyId, after: { reason } },
        db,
      );
      await this.notifications.notifyAgencyUsers(db, agencyId, {
        eventType: 'AGENCY_BLOCKED',
        subject: 'New business blocked – overdue contributions',
        body: `${reason}. Submit payment for the overdue policies to restore issuance.`,
        link: '/portal/billing',
        channels: ['EMAIL', 'SMS'],
      });
      this.logger.log(`Agency ${agency.code} blocked: ${reason}`);
    } else if (overdueCount === 0 && agency.issuanceBlocked) {
      await db.agency.update({
        where: { id: agencyId },
        data: { issuanceBlocked: false, issuanceBlockedAt: null, issuanceBlockReason: null },
      });
      await this.audit.record(
        { action: 'AGENCY_UNBLOCKED', entityType: 'Agency', entityId: agencyId },
        db,
      );
      await this.notifications.notifyAgencyUsers(db, agencyId, {
        eventType: 'AGENCY_UNBLOCKED',
        subject: 'New business restored',
        body: 'All overdue contributions have been submitted. You can issue new policies again.',
        link: '/portal',
      });
    }
  }
}
