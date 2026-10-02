import { DataScopeService } from '../../common/security/data-scope.service.js';
import { addDays, businessToday, daysBetween } from '../../common/util/dates.js';
import type { Prisma } from '../../generated/prisma/client.js';
import {
  AgentStatus,
  AmlCaseStatus,
  ApprovalStatus,
  ClaimStatus,
  IssueStatus,
  PolicyStatus,
} from '../../generated/prisma/enums.js';
import type { ReportContext, ReportDefinition, ReportRow } from './report-types.js';

/**
 * Standard reports (BO-22, AP-58). Each definition declares its filters and columns and
 * queries through Prisma only (parameterised). Portal users always run reports inside
 * their data scope; back-office users may additionally filter by agency.
 */

function dateRange(context: ReportContext): { gte?: Date; lt?: Date } {
  return { gte: context.filters.from, lt: context.filters.to };
}

function policyScope(context: ReportContext): Prisma.PolicyWhereInput {
  return {
    ...DataScopeService.recordFilter(context.scope),
    ...(context.scope.unrestricted && context.filters.agencyId
      ? { agencyId: context.filters.agencyId }
      : {}),
    ...(context.filters.agentId ? { agentId: context.filters.agentId } : {}),
    ...(context.filters.productId ? { productId: context.filters.productId } : {}),
  };
}

/** Narrows a free-text status filter to a valid enum value (anything else is ignored). */
function statusFilter<T extends string>(
  value: string | undefined,
  enumObject: Record<string, T>,
): T | undefined {
  return Object.values(enumObject).find((candidate) => candidate === value);
}

/** Elapsed hours to one decimal place, or null when the end time is not reached yet. */
function hours(from: Date, to: Date | null): number | null {
  return to ? Math.round(((to.getTime() - from.getTime()) / 3_600_000) * 10) / 10 : null;
}

function decimal(value: { toNumber(): number } | null | undefined): number | null {
  return value ? value.toNumber() : null;
}

const policyRegister: ReportDefinition = {
  code: 'POLICY_REGISTER',
  name: 'Policy register',
  description: 'Policies issued in the period with participant, agent and contribution details.',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['dateRange', 'product', 'agency', 'agent', 'status'],
  statusOptions: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  dateLabel: 'Issue date',
  columns: [
    { key: 'policyNo', header: 'Policy no.', type: 'text', width: 18 },
    { key: 'issuedAt', header: 'Issued', type: 'date', width: 12 },
    { key: 'product', header: 'Product', type: 'text', width: 30 },
    { key: 'participant', header: 'Participant', type: 'text', width: 28 },
    { key: 'agent', header: 'Agent / banker', type: 'text', width: 24 },
    { key: 'agency', header: 'Agency / bank', type: 'text', width: 24 },
    { key: 'status', header: 'Status', type: 'text', width: 12 },
    { key: 'sumCovered', header: 'Sum covered (B$)', type: 'money', width: 16 },
    { key: 'contribution', header: 'Contribution (B$)', type: 'money', width: 16 },
    { key: 'outstanding', header: 'Outstanding (B$)', type: 'money', width: 16 },
  ],
  async run(context) {
    const rows = await context.prisma.policy.findMany({
      where: {
        ...policyScope(context),
        policyNo: { not: null },
        issuedAt: dateRange(context),
        status: statusFilter(context.filters.status, PolicyStatus),
      },
      include: { product: true, participant: true, agent: true, agency: true },
      orderBy: { issuedAt: 'asc' },
      take: context.limit,
    });
    return rows.map((p) => ({
      policyNo: p.policyNo,
      issuedAt: p.issuedAt,
      product: p.product.name,
      participant: p.participant.fullName,
      agent: `${p.agent.fullName} (${p.agent.agentCode})`,
      agency: p.agency.name,
      status: p.status,
      sumCovered: decimal(p.sumCovered),
      contribution: decimal(p.contribution),
      outstanding: decimal(p.outstandingAmount),
    }));
  },
};

const productionSummary: ReportDefinition = {
  code: 'PRODUCTION_SUMMARY',
  name: 'Production summary by product',
  description: 'Number of policies, sum covered and contribution issued per product.',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['dateRange', 'agency', 'agent'],
  dateLabel: 'Issue date',
  columns: [
    { key: 'productCode', header: 'Code', type: 'text', width: 10 },
    { key: 'product', header: 'Product', type: 'text', width: 40 },
    { key: 'lineOfBusiness', header: 'Line of business', type: 'text', width: 20 },
    { key: 'policies', header: 'Policies', type: 'number', width: 10 },
    { key: 'sumCovered', header: 'Sum covered (B$)', type: 'money', width: 18 },
    { key: 'contribution', header: 'Contribution (B$)', type: 'money', width: 18 },
  ],
  async run(context) {
    const groups = await context.prisma.policy.groupBy({
      by: ['productId'],
      where: {
        ...policyScope(context),
        policyNo: { not: null },
        issuedAt: dateRange(context),
        status: { not: 'CANCELLED' },
      },
      _count: { _all: true },
      _sum: { sumCovered: true, contribution: true },
    });
    const products = await context.prisma.product.findMany({ orderBy: { sortOrder: 'asc' } });
    return products.map((product) => {
      const group = groups.find((g) => g.productId === product.id);
      return {
        productCode: product.code,
        product: product.name,
        lineOfBusiness: product.lineOfBusiness,
        policies: group?._count._all ?? 0,
        sumCovered: decimal(group?._sum.sumCovered) ?? 0,
        contribution: decimal(group?._sum.contribution) ?? 0,
      };
    });
  },
};

const agencyPerformance: ReportDefinition = {
  code: 'AGENCY_PERFORMANCE',
  name: 'Agency / bank performance',
  description: 'New business, outstanding and overdue contributions per agency or bank.',
  audiences: ['BACKOFFICE'],
  filters: ['dateRange'],
  dateLabel: 'Issue date',
  columns: [
    { key: 'code', header: 'Code', type: 'text', width: 10 },
    { key: 'agency', header: 'Agency / bank', type: 'text', width: 34 },
    { key: 'channel', header: 'Channel', type: 'text', width: 10 },
    { key: 'activeAgents', header: 'Active agents', type: 'number', width: 12 },
    { key: 'policies', header: 'Policies issued', type: 'number', width: 14 },
    { key: 'contribution', header: 'Contribution (B$)', type: 'money', width: 18 },
    { key: 'outstanding', header: 'Outstanding (B$)', type: 'money', width: 18 },
    { key: 'overdue', header: 'Overdue policies', type: 'number', width: 14 },
    { key: 'blocked', header: 'Issuance blocked', type: 'text', width: 14 },
  ],
  async run(context) {
    const today = businessToday();
    const agencies = await context.prisma.agency.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { agents: { where: { status: 'ACTIVE' } } } } },
      take: context.limit,
    });
    const [issued, outstanding, overdue] = await Promise.all([
      context.prisma.policy.groupBy({
        by: ['agencyId'],
        where: { policyNo: { not: null }, issuedAt: dateRange(context) },
        _count: { _all: true },
        _sum: { contribution: true },
      }),
      context.prisma.policy.groupBy({
        by: ['agencyId'],
        where: { status: { in: ['ACTIVE', 'PENDING_PAYMENT'] }, outstandingAmount: { gt: 0 } },
        _sum: { outstandingAmount: true },
      }),
      context.prisma.policy.groupBy({
        by: ['agencyId'],
        where: { status: 'ACTIVE', paymentStatus: 'UNPAID', paymentDueDate: { lt: today } },
        _count: { _all: true },
      }),
    ]);
    return agencies.map((agency) => ({
      code: agency.code,
      agency: agency.name,
      channel: agency.channel,
      activeAgents: agency._count.agents,
      policies: issued.find((g) => g.agencyId === agency.id)?._count._all ?? 0,
      contribution: decimal(issued.find((g) => g.agencyId === agency.id)?._sum.contribution) ?? 0,
      outstanding:
        decimal(outstanding.find((g) => g.agencyId === agency.id)?._sum.outstandingAmount) ?? 0,
      overdue: overdue.find((g) => g.agencyId === agency.id)?._count._all ?? 0,
      blocked: agency.issuanceBlocked ? 'Yes' : 'No',
    }));
  },
};

const collections: ReportDefinition = {
  code: 'COLLECTIONS',
  name: 'Collections (e-Receipts)',
  description: 'Receipts issued in the period, for reconciliation with the bank statement and FIN.',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['dateRange', 'product', 'agency', 'agent'],
  dateLabel: 'Receipt date',
  columns: [
    { key: 'receiptNo', header: 'Receipt no.', type: 'text', width: 16 },
    { key: 'issuedAt', header: 'Receipt date', type: 'date', width: 12 },
    { key: 'policyNo', header: 'Policy / quotation', type: 'text', width: 18 },
    { key: 'participant', header: 'Participant', type: 'text', width: 28 },
    { key: 'agency', header: 'Agency / bank', type: 'text', width: 24 },
    { key: 'paymentNo', header: 'Payment batch', type: 'text', width: 16 },
    { key: 'method', header: 'Method', type: 'text', width: 14 },
    { key: 'reference', header: 'Bank reference', type: 'text', width: 18 },
    { key: 'amount', header: 'Amount (B$)', type: 'money', width: 14 },
  ],
  async run(context) {
    const rows = await context.prisma.receipt.findMany({
      where: { issuedAt: dateRange(context), policy: policyScope(context) },
      include: { payment: true, policy: { include: { participant: true, agency: true } } },
      orderBy: { issuedAt: 'asc' },
      take: context.limit,
    });
    return rows.map((r) => ({
      receiptNo: r.receiptNo,
      issuedAt: r.issuedAt,
      policyNo: r.policy.policyNo ?? r.policy.quotationNo,
      participant: r.policy.participant.fullName,
      agency: r.policy.agency.name,
      paymentNo: r.payment.paymentNo,
      method: r.payment.method,
      reference: r.payment.referenceNo,
      amount: decimal(r.amount),
    }));
  },
};

const outstandingAgeing: ReportDefinition = {
  code: 'OUTSTANDING_AGEING',
  name: 'Outstanding contribution ageing',
  description: 'Unpaid contributions by days past the payment due date (grace period monitoring).',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['product', 'agency', 'agent'],
  columns: [
    { key: 'policyNo', header: 'Policy / quotation', type: 'text', width: 18 },
    { key: 'participant', header: 'Participant', type: 'text', width: 28 },
    { key: 'agent', header: 'Agent / banker', type: 'text', width: 24 },
    { key: 'agency', header: 'Agency / bank', type: 'text', width: 24 },
    { key: 'dueDate', header: 'Due date', type: 'date', width: 12 },
    { key: 'daysOverdue', header: 'Days overdue', type: 'number', width: 12 },
    { key: 'bucket', header: 'Ageing', type: 'text', width: 12 },
    { key: 'outstanding', header: 'Outstanding (B$)', type: 'money', width: 16 },
  ],
  async run(context) {
    const today = businessToday();
    const rows = await context.prisma.policy.findMany({
      where: {
        ...policyScope(context),
        status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
        outstandingAmount: { gt: 0 },
      },
      include: { participant: true, agent: true, agency: true },
      orderBy: { paymentDueDate: 'asc' },
      take: context.limit,
    });
    return rows.map((p) => {
      const days = p.paymentDueDate ? Math.max(0, daysBetween(p.paymentDueDate, today)) : 0;
      return {
        policyNo: p.policyNo ?? p.quotationNo,
        participant: p.participant.fullName,
        agent: p.agent.fullName,
        agency: p.agency.name,
        dueDate: p.paymentDueDate,
        daysOverdue: days,
        bucket:
          days === 0
            ? 'Current'
            : days <= 7
              ? '1–7 days'
              : days <= 30
                ? '8–30 days'
                : 'Over 30 days',
        outstanding: decimal(p.outstandingAmount),
      };
    });
  },
};

const agentListing: ReportDefinition = {
  code: 'AGENT_LISTING',
  name: 'Agent / banker listing',
  description: 'Agents and bank officers with status, hierarchy, AML status and licence expiry.',
  audiences: ['BACKOFFICE'],
  filters: ['agency', 'status'],
  statusOptions: ['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'REJECTED'],
  columns: [
    { key: 'agentCode', header: 'Code', type: 'text', width: 12 },
    { key: 'fullName', header: 'Name', type: 'text', width: 28 },
    { key: 'agentType', header: 'Type', type: 'text', width: 12 },
    { key: 'agency', header: 'Agency / bank', type: 'text', width: 26 },
    { key: 'reportsTo', header: 'Reports to', type: 'text', width: 24 },
    { key: 'status', header: 'Status', type: 'text', width: 12 },
    { key: 'amlStatus', header: 'AML', type: 'text', width: 12 },
    { key: 'licenceExpiry', header: 'Licence expiry', type: 'date', width: 14 },
    { key: 'activatedAt', header: 'Activated', type: 'date', width: 12 },
  ],
  async run(context) {
    const rows = await context.prisma.agent.findMany({
      where: {
        agencyId: context.filters.agencyId,
        status: statusFilter(context.filters.status, AgentStatus),
      },
      include: { agency: true, parent: true },
      orderBy: { agentCode: 'asc' },
      take: context.limit,
    });
    return rows.map((a) => ({
      agentCode: a.agentCode,
      fullName: a.fullName,
      agentType: a.agentType,
      agency: a.agency.name,
      reportsTo: a.parent?.fullName ?? null,
      status: a.status,
      amlStatus: a.amlStatus,
      licenceExpiry: a.licenceExpiry,
      activatedAt: a.activatedAt,
    }));
  },
};

const claimsRegister: ReportDefinition = {
  code: 'CLAIMS_REGISTER',
  name: 'Claim notifications',
  description: 'Claims notified in the period with status.',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['dateRange', 'agency', 'status'],
  statusOptions: ['SUBMITTED', 'UNDER_REVIEW', 'ACKNOWLEDGED', 'REJECTED', 'CLOSED'],
  dateLabel: 'Notification date',
  columns: [
    { key: 'claimNo', header: 'Claim no.', type: 'text', width: 16 },
    { key: 'notifiedAt', header: 'Notified', type: 'date', width: 12 },
    { key: 'policyNo', header: 'Policy no.', type: 'text', width: 18 },
    { key: 'participant', header: 'Participant', type: 'text', width: 28 },
    { key: 'claimType', header: 'Type', type: 'text', width: 18 },
    { key: 'eventDate', header: 'Event date', type: 'date', width: 12 },
    { key: 'status', header: 'Status', type: 'text', width: 14 },
    { key: 'claimedAmount', header: 'Claimed (B$)', type: 'money', width: 14 },
  ],
  async run(context) {
    const rows = await context.prisma.claim.findMany({
      where: {
        ...DataScopeService.recordFilter(context.scope),
        agencyId: context.scope.unrestricted ? context.filters.agencyId : context.scope.agencyId,
        createdAt: dateRange(context),
        status: statusFilter(context.filters.status, ClaimStatus),
      },
      include: { policy: { include: { participant: true } } },
      orderBy: { createdAt: 'asc' },
      take: context.limit,
    });
    return rows.map((c) => ({
      claimNo: c.claimNo,
      notifiedAt: c.createdAt,
      policyNo: c.policy.policyNo,
      participant: c.policy.participant.fullName,
      claimType: c.claimType,
      eventDate: c.eventDate,
      status: c.status,
      claimedAmount: decimal(c.claimedAmount),
    }));
  },
};

const amlScreening: ReportDefinition = {
  code: 'AML_SCREENING',
  name: 'AML/KYC screening log',
  description: 'Screenings performed in the period with score and review outcome.',
  audiences: ['BACKOFFICE'],
  filters: ['dateRange', 'status'],
  statusOptions: ['AUTO_CLEARED', 'PENDING_REVIEW', 'CLEARED', 'CONFIRMED_MATCH'],
  dateLabel: 'Screening date',
  columns: [
    { key: 'screenedAt', header: 'Screened', type: 'datetime', width: 18 },
    { key: 'subjectType', header: 'Subject type', type: 'text', width: 14 },
    { key: 'subjectName', header: 'Name', type: 'text', width: 30 },
    { key: 'provider', header: 'Source', type: 'text', width: 18 },
    { key: 'score', header: 'Score', type: 'number', width: 8 },
    { key: 'status', header: 'Outcome', type: 'text', width: 16 },
    { key: 'reviewedAt', header: 'Reviewed', type: 'datetime', width: 18 },
    { key: 'remarks', header: 'Review remarks', type: 'text', width: 40 },
  ],
  async run(context) {
    const rows = await context.prisma.amlScreening.findMany({
      where: {
        createdAt: dateRange(context),
        status: statusFilter(context.filters.status, AmlCaseStatus),
      },
      orderBy: { createdAt: 'asc' },
      take: context.limit,
    });
    return rows.map((s) => ({
      screenedAt: s.createdAt,
      subjectType: s.subjectType,
      subjectName: s.subjectName,
      provider: s.provider,
      score: s.score,
      status: s.status,
      reviewedAt: s.reviewedAt,
      remarks: s.reviewRemarks,
    }));
  },
};

const issueSla: ReportDefinition = {
  code: 'ISSUE_SLA',
  name: 'Issue SLA performance',
  description: 'Issues reported in the period with response/resolution times against SLA.',
  audiences: ['BACKOFFICE'],
  filters: ['dateRange', 'status'],
  statusOptions: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  dateLabel: 'Reported date',
  columns: [
    { key: 'issueNo', header: 'Issue no.', type: 'text', width: 16 },
    { key: 'reportedAt', header: 'Reported', type: 'datetime', width: 18 },
    { key: 'title', header: 'Title', type: 'text', width: 36 },
    { key: 'priority', header: 'Priority', type: 'text', width: 10 },
    { key: 'status', header: 'Status', type: 'text', width: 12 },
    { key: 'assignedTo', header: 'Assigned to', type: 'text', width: 22 },
    { key: 'responseHours', header: 'Response (h)', type: 'number', width: 12 },
    { key: 'resolutionHours', header: 'Resolution (h)', type: 'number', width: 12 },
    { key: 'breached', header: 'SLA breached', type: 'text', width: 12 },
  ],
  async run(context) {
    const rows = await context.prisma.issue.findMany({
      where: {
        createdAt: dateRange(context),
        status: statusFilter(context.filters.status, IssueStatus),
      },
      orderBy: { createdAt: 'asc' },
      take: context.limit,
    });
    return rows.map((i) => ({
      issueNo: i.issueNo,
      reportedAt: i.createdAt,
      title: i.title,
      priority: i.priority,
      status: i.status,
      assignedTo: i.assignedToName,
      responseHours: hours(i.createdAt, i.firstRespondedAt),
      resolutionHours: hours(i.createdAt, i.resolvedAt),
      breached: i.slaBreached ? 'Yes' : 'No',
    }));
  },
};

const renewalsDue: ReportDefinition = {
  code: 'RENEWALS_DUE',
  name: 'Renewals due',
  description: 'Policies whose cover ends in the period (expiry date range).',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['dateRange', 'product', 'agency', 'agent'],
  dateLabel: 'Expiry date',
  columns: [
    { key: 'policyNo', header: 'Policy no.', type: 'text', width: 18 },
    { key: 'product', header: 'Product', type: 'text', width: 30 },
    { key: 'participant', header: 'Participant', type: 'text', width: 28 },
    { key: 'mobile', header: 'Mobile', type: 'text', width: 14 },
    { key: 'agent', header: 'Agent / banker', type: 'text', width: 24 },
    { key: 'endDate', header: 'Expiry', type: 'date', width: 12 },
    { key: 'contribution', header: 'Contribution (B$)', type: 'money', width: 16 },
  ],
  async run(context) {
    const today = businessToday();
    const rows = await context.prisma.policy.findMany({
      where: {
        ...policyScope(context),
        status: { in: ['ACTIVE', 'EXPIRED'] },
        product: { allowRenewal: true },
        endDate: {
          gte: context.filters.from ?? today,
          lt: context.filters.to ?? addDays(today, 60),
        },
      },
      include: { product: true, participant: true, agent: true },
      orderBy: { endDate: 'asc' },
      take: context.limit,
    });
    return rows.map((p) => ({
      policyNo: p.policyNo,
      product: p.product.name,
      participant: p.participant.fullName,
      mobile: p.participant.mobile,
      agent: p.agent.fullName,
      endDate: p.endDate,
      contribution: decimal(p.contribution),
    }));
  },
};

const commissionStatement: ReportDefinition = {
  code: 'COMMISSION_STATEMENT',
  name: 'Commission / referral fee statement',
  description: 'Commission accrued on policies issued in the period.',
  audiences: ['PORTAL', 'BACKOFFICE'],
  filters: ['dateRange', 'agency', 'agent'],
  dateLabel: 'Accrual date',
  columns: [
    { key: 'period', header: 'Period', type: 'text', width: 10 },
    { key: 'agent', header: 'Agent / banker', type: 'text', width: 28 },
    { key: 'policyNo', header: 'Policy no.', type: 'text', width: 18 },
    { key: 'product', header: 'Product', type: 'text', width: 30 },
    { key: 'contribution', header: 'Contribution (B$)', type: 'money', width: 16 },
    { key: 'rate', header: 'Rate', type: 'number', width: 8 },
    { key: 'amount', header: 'Commission (B$)', type: 'money', width: 16 },
    { key: 'status', header: 'Status', type: 'text', width: 10 },
  ],
  async run(context) {
    const rows: ReportRow[] = [];
    const items = await context.prisma.commission.findMany({
      where: {
        createdAt: dateRange(context),
        agentId:
          context.filters.agentId ??
          (context.scope.agentIds ? { in: context.scope.agentIds } : undefined),
        agent: {
          agencyId: context.scope.unrestricted ? context.filters.agencyId : context.scope.agencyId,
        },
      },
      include: { agent: true, policy: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
      take: context.limit,
    });
    for (const c of items) {
      rows.push({
        period: c.period,
        agent: `${c.agent.fullName} (${c.agent.agentCode})`,
        policyNo: c.policy.policyNo,
        product: c.policy.product.name,
        contribution: decimal(c.contribution),
        rate: c.rate.toNumber(),
        amount: decimal(c.amount),
        status: c.status,
      });
    }
    return rows;
  },
};

const approvalTurnaround: ReportDefinition = {
  code: 'APPROVAL_TURNAROUND',
  name: 'Approval turnaround',
  description: 'Maker-checker requests decided in the period with turnaround time.',
  audiences: ['BACKOFFICE'],
  filters: ['dateRange', 'status'],
  statusOptions: ['APPROVED', 'REJECTED', 'WITHDRAWN'],
  dateLabel: 'Decision date',
  columns: [
    { key: 'requestNo', header: 'Request no.', type: 'text', width: 16 },
    { key: 'type', header: 'Type', type: 'text', width: 22 },
    { key: 'summary', header: 'Summary', type: 'text', width: 50 },
    { key: 'maker', header: 'Submitted by', type: 'text', width: 22 },
    { key: 'submittedAt', header: 'Submitted', type: 'datetime', width: 18 },
    { key: 'decidedAt', header: 'Decided', type: 'datetime', width: 18 },
    { key: 'status', header: 'Outcome', type: 'text', width: 12 },
    { key: 'hours', header: 'Turnaround (h)', type: 'number', width: 12 },
  ],
  async run(context) {
    const rows = await context.prisma.approvalRequest.findMany({
      where: {
        decidedAt: dateRange(context),
        status: statusFilter(context.filters.status, ApprovalStatus) ?? { not: 'PENDING' },
        totalLevels: { gt: 0 },
      },
      orderBy: { decidedAt: 'asc' },
      take: context.limit,
    });
    return rows.map((r) => ({
      requestNo: r.requestNo,
      type: r.type,
      summary: r.summary,
      maker: r.makerName,
      submittedAt: r.submittedAt,
      decidedAt: r.decidedAt,
      status: r.status,
      hours: hours(r.submittedAt, r.decidedAt),
    }));
  },
};

export const REPORTS: ReportDefinition[] = [
  policyRegister,
  productionSummary,
  agencyPerformance,
  collections,
  outstandingAgeing,
  agentListing,
  claimsRegister,
  amlScreening,
  issueSla,
  renewalsDue,
  commissionStatement,
  approvalTurnaround,
];
