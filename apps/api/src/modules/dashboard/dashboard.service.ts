import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { type DataScope, DataScopeService } from '../../common/security/data-scope.service.js';
import { Permission } from '../../common/security/permissions.js';
import { hasPermission, type SessionUser } from '../../common/security/session-user.js';
import { addDays, businessToday } from '../../common/util/dates.js';
import { Prisma } from '../../generated/prisma/client.js';
import { WorkflowService } from '../workflow/workflow.service.js';

interface MonthlyRow {
  month: Date;
  policies: bigint;
  contribution: Prisma.Decimal | null;
}

/** AP-52/53 (agent dashboard) and BO-20/21 (back-office pending actions and management KPIs). */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: DataScopeService,
    private readonly workflow: WorkflowService,
  ) {}

  async portal(user: SessionUser) {
    const scope = await this.scopes.resolve(user);
    const filter = DataScopeService.recordFilter(scope);
    const today = businessToday();

    const [
      agent,
      statusCounts,
      outstanding,
      overdue,
      renewalsDue,
      rejected,
      drafts,
      recentEvents,
      unread,
      openIssues,
      rejectedRequests,
    ] = await Promise.all([
      this.prisma.agent.findUniqueOrThrow({
        where: { id: user.agentId! },
        include: {
          agency: {
            select: {
              name: true,
              code: true,
              channel: true,
              issuanceBlocked: true,
              issuanceBlockReason: true,
            },
          },
          parent: { select: { fullName: true } },
        },
      }),
      this.prisma.policy.groupBy({
        by: ['status'],
        where: filter,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.policy.aggregate({
        where: {
          ...filter,
          status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
          paymentStatus: 'UNPAID',
        },
        _sum: { outstandingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.policy.count({
        where: {
          ...filter,
          status: 'ACTIVE',
          paymentStatus: 'UNPAID',
          paymentDueDate: { lt: today },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...filter,
          status: 'ACTIVE',
          product: { allowRenewal: true },
          endDate: { gte: today, lte: addDays(today, 30) },
        },
      }),
      this.prisma.policy.findMany({
        where: { ...filter, status: 'REJECTED' },
        select: { id: true, quotationNo: true, rejectedReason: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.policy.findMany({
        where: { ...filter, status: 'DRAFT' },
        select: {
          id: true,
          quotationNo: true,
          createdAt: true,
          participant: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 5,
      }),
      this.prisma.policyEvent.findMany({
        where: { policy: filter },
        include: { policy: { select: { id: true, quotationNo: true, policyNo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notification.count({
        where: { userId: user.id, channel: 'IN_APP', readAt: null },
      }),
      this.prisma.issue.count({ where: { reportedById: user.id, status: { notIn: ['CLOSED'] } } }),
      this.prisma.approvalRequest.findMany({
        where: { makerId: user.id, status: 'REJECTED' },
        select: { id: true, requestNo: true, summary: true, finalRemarks: true },
        orderBy: { decidedAt: 'desc' },
        take: 5,
      }),
    ]);

    const count = (status: string) =>
      statusCounts.find((row) => row.status === status)?._count._all ?? 0;
    const pendingActions = [
      ...(agent.agency.issuanceBlocked
        ? [
            {
              type: 'AGENCY_BLOCKED',
              title: 'New business blocked',
              detail: agent.agency.issuanceBlockReason ?? '',
              link: '/portal/billing',
            },
          ]
        : []),
      ...(overdue > 0
        ? [
            {
              type: 'OVERDUE',
              title: `${overdue} policy(ies) with overdue contribution`,
              detail: 'Submit payment to avoid the agency being blocked',
              link: '/portal/billing',
            },
          ]
        : []),
      ...rejected.map((p) => ({
        type: 'REJECTED_QUOTATION',
        title: `Quotation ${p.quotationNo} rejected`,
        detail: p.rejectedReason ?? '',
        link: `/portal/policies/${p.id}`,
      })),
      ...rejectedRequests.map((r) => ({
        type: 'REJECTED_REQUEST',
        title: `Request ${r.requestNo} rejected`,
        detail: r.finalRemarks ?? r.summary,
        link: `/portal/requests/${r.id}`,
      })),
      ...drafts.map((p) => ({
        type: 'DRAFT',
        title: `Incomplete quotation ${p.quotationNo}`,
        detail: p.participant.fullName,
        link: `/portal/policies/${p.id}`,
      })),
    ];

    return {
      profile: {
        fullName: agent.fullName,
        agentCode: agent.agentCode,
        agentType: agent.agentType,
        status: agent.status,
        reportsTo: agent.parent?.fullName ?? null,
        agency: agent.agency,
      },
      counts: {
        draft: count('DRAFT'),
        pendingApproval: count('PENDING_APPROVAL'),
        pendingPayment: count('PENDING_PAYMENT'),
        active: count('ACTIVE'),
        rejected: count('REJECTED'),
        expired: count('EXPIRED'),
        renewalsDue,
        overdue,
        outstandingCount: outstanding._count._all,
        outstandingAmount: outstanding._sum.outstandingAmount ?? new Prisma.Decimal(0),
        unreadNotifications: unread,
        openIssues,
      },
      pendingActions,
      monthly: await this.monthly(scope, 6),
      recentActivity: recentEvents.map((event) => ({
        id: event.id,
        action: event.action,
        remarks: event.remarks,
        actorName: event.actorName,
        createdAt: event.createdAt,
        policyId: event.policy.id,
        reference: event.policy.policyNo ?? event.policy.quotationNo,
      })),
    };
  }

  async backoffice(user: SessionUser) {
    const today = businessToday();
    const [
      inbox,
      pendingByType,
      amlReview,
      documentsToVerify,
      paymentsPending,
      claimsOpen,
      issuesOpen,
      issuesBreached,
      integrationDead,
      pendingAgents,
    ] = await Promise.all([
      this.workflow.inbox(user, { page: 1, pageSize: 5 }, {}),
      this.prisma.approvalRequest.groupBy({
        by: ['type'],
        where: { status: 'PENDING' },
        _count: { _all: true },
        orderBy: { type: 'asc' },
      }),
      this.prisma.amlScreening.count({ where: { status: 'PENDING_REVIEW' } }),
      this.prisma.document.count({ where: { status: 'UPLOADED', systemGenerated: false } }),
      this.prisma.payment.aggregate({
        where: { status: 'PENDING_VERIFICATION' },
        _count: { _all: true },
        _sum: { totalAmount: true },
      }),
      this.prisma.claim.count({ where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } } }),
      this.prisma.issue.count({ where: { status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
      this.prisma.issue.count({
        where: { slaBreached: true, status: { notIn: ['RESOLVED', 'CLOSED'] } },
      }),
      this.prisma.outboxMessage.count({ where: { status: 'DEAD' } }),
      this.prisma.agent.count({ where: { status: 'PENDING' } }),
    ]);

    const pending = {
      myApprovals: inbox.total,
      myApprovalItems: inbox.items,
      pendingByType: Object.fromEntries(pendingByType.map((row) => [row.type, row._count._all])),
      pendingAgents,
      amlReview,
      documentsToVerify,
      paymentsPending: paymentsPending._count._all,
      paymentsPendingAmount: paymentsPending._sum.totalAmount ?? new Prisma.Decimal(0),
      claimsOpen,
      issuesOpen,
      issuesBreached,
      integrationDead,
    };
    if (!hasPermission(user, Permission.BoManagementDashboard)) {
      return { pending };
    }

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const yearStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    const issuedSince = (from: Date) =>
      this.prisma.policy.aggregate({
        where: { issuedAt: { gte: from }, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { contribution: true },
      });
    const [
      mtd,
      ytd,
      activeAgents,
      activeAgencies,
      outstanding,
      overdue,
      blockedAgencies,
      byProduct,
      byChannel,
    ] = await Promise.all([
      issuedSince(monthStart),
      issuedSince(yearStart),
      this.prisma.agent.count({ where: { status: 'ACTIVE' } }),
      this.prisma.agency.count({ where: { status: 'ACTIVE' } }),
      this.prisma.policy.aggregate({
        where: { status: { in: ['ACTIVE', 'PENDING_PAYMENT'] }, outstandingAmount: { gt: 0 } },
        _sum: { outstandingAmount: true },
      }),
      this.prisma.policy.aggregate({
        where: { status: 'ACTIVE', paymentStatus: 'UNPAID', paymentDueDate: { lt: today } },
        _sum: { outstandingAmount: true },
        _count: { _all: true },
      }),
      this.prisma.agency.findMany({
        where: { issuanceBlocked: true },
        select: {
          id: true,
          code: true,
          name: true,
          issuanceBlockedAt: true,
          issuanceBlockReason: true,
        },
      }),
      this.prisma.policy.groupBy({
        by: ['productId'],
        where: { issuedAt: { gte: yearStart }, status: { not: 'CANCELLED' } },
        _count: { _all: true },
        _sum: { contribution: true },
      }),
      this.prisma.$queryRaw<
        { channel: string; policies: bigint; contribution: Prisma.Decimal | null }[]
      >`
        SELECT a.channel::text AS channel, COUNT(*) AS policies, SUM(p.contribution) AS contribution
        FROM policy p JOIN agency a ON a.id = p.agency_id
        WHERE p.issued_at >= ${yearStart} AND p.status <> 'CANCELLED'
        GROUP BY a.channel`,
    ]);
    const products = await this.prisma.product.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });

    return {
      pending,
      kpis: {
        policiesMtd: mtd._count._all,
        contributionMtd: mtd._sum.contribution ?? 0,
        policiesYtd: ytd._count._all,
        contributionYtd: ytd._sum.contribution ?? 0,
        activeAgents,
        activeAgencies,
        outstandingAmount: outstanding._sum.outstandingAmount ?? 0,
        overdueAmount: overdue._sum.outstandingAmount ?? 0,
        overdueCount: overdue._count._all,
      },
      blockedAgencies,
      trend: await this.monthly({ unrestricted: true }, 12),
      byProduct: products.map((product) => {
        const row = byProduct.find((g) => g.productId === product.id);
        return {
          code: product.code,
          name: product.name,
          policies: row?._count._all ?? 0,
          contribution: row?._sum.contribution ?? 0,
        };
      }),
      byChannel: byChannel.map((row) => ({
        channel: row.channel,
        policies: Number(row.policies),
        contribution: row.contribution ?? 0,
      })),
    };
  }

  /** Policies issued and contribution per month (Brunei time), most recent `months` months. */
  private async monthly(scope: DataScope, months: number) {
    const today = businessToday();
    const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (months - 1), 1));
    const agencyId = scope.unrestricted ? null : (scope.agencyId ?? null);
    const agentIds = scope.unrestricted || !scope.agentIds ? null : scope.agentIds;
    const rows = await this.prisma.$queryRaw<MonthlyRow[]>`
      SELECT date_trunc('month', issued_at AT TIME ZONE 'Asia/Brunei') AS month,
             COUNT(*) AS policies,
             SUM(contribution) AS contribution
      FROM policy
      WHERE issued_at >= ${from}
        AND status <> 'CANCELLED'
        AND (${agencyId}::uuid IS NULL OR agency_id = ${agencyId}::uuid)
        AND (${agentIds}::uuid[] IS NULL OR agent_id = ANY(${agentIds}::uuid[]))
      GROUP BY 1
      ORDER BY 1`;
    return Array.from({ length: months }, (_, index) => {
      const month = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + index, 1));
      const key = month.toISOString().slice(0, 7);
      const row = rows.find((r) => r.month.toISOString().slice(0, 7) === key);
      return {
        month: key,
        policies: row ? Number(row.policies) : 0,
        contribution: row?.contribution?.toNumber() ?? 0,
      };
    });
  }
}
