import { Injectable } from '@nestjs/common';
import { notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { businessDayRange, parseIsoDate } from '../../common/util/dates.js';
import type { AgentStatus, IntegrationSystem } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';

/** Handles calls made by IITH systems into the portal. Every call is logged for reconciliation. */
@Injectable()
export class InboundIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  /** INT-02: agent status maintained in the core system is mirrored to the portal. */
  async syncAgentStatus(
    agentCode: string,
    status: Extract<AgentStatus, 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED'>,
    reason: string,
  ) {
    return this.logged('CORE', 'AGENT_STATUS_SYNC', agentCode, async () => {
      const agent = await this.prisma.agent.findUnique({
        where: { agentCode },
        include: { user: true },
      });
      if (!agent) {
        throw notFound('Agent');
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.agent.update({
          where: { id: agent.id },
          data: {
            status,
            statusReason: `Core system: ${reason}`,
            terminatedAt: status === 'TERMINATED' ? new Date() : undefined,
            version: { increment: 1 },
          },
        });
        if (agent.user) {
          await tx.user.update({
            where: { id: agent.user.id },
            data: { status: status === 'ACTIVE' ? 'ACTIVE' : 'DISABLED' },
          });
        }
        await this.audit.record(
          {
            action: 'AGENT_STATUS_SYNCED',
            entityType: 'Agent',
            entityId: agent.id,
            before: { status: agent.status },
            after: { status, reason, source: 'CORE' },
          },
          tx,
        );
      });
      if (agent.user && status !== 'ACTIVE') {
        await this.sessions.revokeAllSessions(agent.user.id);
      }
      return { agentCode, status };
    });
  }

  /** INT-09: policies issued on a business date, for the core/financial systems to pull. */
  async issuedPolicies(businessDate: Date) {
    return this.logged(
      'CORE',
      'ISSUED_POLICIES_QUERY',
      businessDate.toISOString().slice(0, 10),
      async () => {
        const { from, to } = businessDayRange(businessDate);
        const policies = await this.prisma.policy.findMany({
          where: { issuedAt: { gte: from, lt: to } },
          include: { product: true, participant: true, agent: true, agency: true },
          orderBy: { issuedAt: 'asc' },
        });
        return policies.map((p) => ({
          policyNo: p.policyNo,
          quotationNo: p.quotationNo,
          productCode: p.product.code,
          participantNo: p.participant.participantNo,
          agentCode: p.agent.agentCode,
          agencyCode: p.agency.code,
          status: p.status,
          sumCovered: p.sumCovered.toFixed(2),
          contribution: p.contribution.toFixed(2),
          outstanding: p.outstandingAmount.toFixed(2),
          startDate: p.startDate?.toISOString().slice(0, 10) ?? null,
          endDate: p.endDate?.toISOString().slice(0, 10) ?? null,
          issuedAt: p.issuedAt,
        }));
      },
    );
  }

  /** INT-05: Finance confirms commission payments so agents see paid status. */
  async markCommissionsPaid(items: { policyNo: string; agentCode: string; paidOn: string }[]) {
    return this.logged('FINANCE', 'COMMISSIONS_PAID', `${items.length} item(s)`, async () => {
      let updated = 0;
      const unmatched: string[] = [];
      await this.prisma.$transaction(async (tx) => {
        for (const item of items) {
          const result = await tx.commission.updateMany({
            where: {
              policy: { policyNo: item.policyNo },
              agent: { agentCode: item.agentCode },
              status: 'ACCRUED',
            },
            data: { status: 'PAID', paidAt: parseIsoDate(item.paidOn) },
          });
          if (result.count === 0) {
            unmatched.push(`${item.policyNo}/${item.agentCode}`);
          }
          updated += result.count;
        }
        await this.audit.record(
          { action: 'COMMISSIONS_PAID', entityType: 'Commission', after: { updated, unmatched } },
          tx,
        );
      });
      return { updated, unmatched };
    });
  }

  private async logged<T>(
    system: IntegrationSystem,
    operation: string,
    reference: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const started = Date.now();
    try {
      const result = await work();
      await this.prisma.integrationLog.create({
        data: {
          system,
          operation,
          direction: 'INBOUND',
          success: true,
          durationMs: Date.now() - started,
          reference: reference.slice(0, 100),
        },
      });
      return result;
    } catch (error) {
      await this.prisma.integrationLog.create({
        data: {
          system,
          operation,
          direction: 'INBOUND',
          success: false,
          durationMs: Date.now() - started,
          reference: reference.slice(0, 100),
          errorMessage: (error as Error).message.slice(0, 1000),
        },
      });
      throw error;
    }
  }
}
