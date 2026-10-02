import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { BUSINESS_TIME_ZONE, businessToday } from '../../common/util/dates.js';
import { NotificationsService } from '../notifications/notifications.service.js';

/** Daily policy housekeeping: expiry (AP-21) with notification to the agent (AP-34). */
@Injectable()
export class PolicyJobs {
  private readonly logger = new Logger(PolicyJobs.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 5 0 * * *', { name: 'policy-expiry', timeZone: BUSINESS_TIME_ZONE })
  async scheduledRun(): Promise<void> {
    if (!this.config.jobs.enabled) {
      return;
    }
    await this.prisma.withJobLock('policy-expiry', async () => {
      await this.expirePolicies();
    });
  }

  async expirePolicies(): Promise<number> {
    const today = businessToday();
    const expiring = await this.prisma.policy.findMany({
      where: { status: 'ACTIVE', endDate: { lt: today } },
      select: { id: true, policyNo: true, agentId: true },
    });
    for (const policy of expiring) {
      await this.prisma.$transaction(async (tx) => {
        await tx.policy.update({
          where: { id: policy.id },
          data: { status: 'EXPIRED', version: { increment: 1 } },
        });
        await tx.policyEvent.create({
          data: {
            policyId: policy.id,
            action: 'EXPIRED',
            fromStatus: 'ACTIVE',
            toStatus: 'EXPIRED',
            actorName: 'System',
          },
        });
        await this.notifications.notifyAgent(tx, policy.agentId, {
          eventType: 'POLICY_EXPIRED',
          subject: `Policy ${policy.policyNo} has expired`,
          body: 'The cover period has ended. Offer the participant a renewal if eligible.',
          link: `/portal/policies/${policy.id}`,
        });
      });
    }
    if (expiring.length > 0) {
      this.logger.log(`Expired ${expiring.length} policy(ies)`);
    }
    return expiring.length;
  }
}
