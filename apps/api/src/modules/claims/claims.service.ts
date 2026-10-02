import { Injectable } from '@nestjs/common';
import { currentActor } from '../../common/context/request-context.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, type PageQueryDto, toPage } from '../../common/http/pagination.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { businessToday, parseIsoDate } from '../../common/util/dates.js';
import { money } from '../../common/util/money.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ClaimStatus } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { CoreOperation, OutboxService } from '../integration/outbox.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MasterDataService } from '../settings/master-data.service.js';

export interface ClaimInput {
  policyId: string;
  claimType: string;
  eventDate: string;
  description: string;
  claimedAmount?: number;
}

const CLAIM_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ACKNOWLEDGED', 'REJECTED'],
  ACKNOWLEDGED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

const CLAIM_INCLUDE = {
  policy: {
    select: {
      id: true,
      policyNo: true,
      startDate: true,
      endDate: true,
      product: { select: { code: true, name: true } },
      participant: { select: { fullName: true, participantNo: true } },
      agent: { select: { agentCode: true, fullName: true } },
      agency: { select: { code: true, name: true } },
    },
  },
} satisfies Prisma.ClaimInclude;

/**
 * AP-43: claim notification. Agents validate the policy, record the event and attach
 * supporting documents; the notification is forwarded to IIFT's claims system for
 * processing, and Claims staff track its status here.
 */
@Injectable()
export class ClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly scopes: DataScopeService,
    private readonly documents: DocumentsService,
    private readonly masterData: MasterDataService,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** Finds a claimable policy by its number within the user's scope. */
  async validatePolicy(user: SessionUser, policyNo: string) {
    const scope = await this.scopes.resolve(user);
    const policy = await this.prisma.policy.findFirst({
      where: { policyNo: policyNo.trim().toUpperCase(), ...DataScopeService.recordFilter(scope) },
      select: {
        id: true,
        policyNo: true,
        status: true,
        startDate: true,
        endDate: true,
        sumCovered: true,
        product: { select: { name: true } },
        participant: { select: { fullName: true } },
      },
    });
    if (!policy) {
      throw notFound('Policy');
    }
    if (!['ACTIVE', 'EXPIRED'].includes(policy.status)) {
      throw new BusinessRuleError(
        'POLICY_NOT_CLAIMABLE',
        `Claims cannot be notified on a ${policy.status.toLowerCase().replace('_', ' ')} policy`,
      );
    }
    return policy;
  }

  async create(user: SessionUser, input: ClaimInput) {
    const scope = await this.scopes.resolve(user);
    const policy = await this.prisma.policy.findUnique({ where: { id: input.policyId } });
    if (!policy || !DataScopeService.allows(scope, policy)) {
      throw notFound('Policy');
    }
    await this.masterData.assertValid('CLAIM_TYPE', input.claimType);
    const eventDate = parseIsoDate(input.eventDate);
    const problems: string[] = [];
    if (!['ACTIVE', 'EXPIRED'].includes(policy.status)) problems.push('The policy is not in force');
    if (eventDate > businessToday()) problems.push('The event date cannot be in the future');
    if (
      !policy.startDate ||
      !policy.endDate ||
      eventDate < policy.startDate ||
      eventDate > policy.endDate
    ) {
      problems.push('The event date must fall within the period of cover');
    }
    if (problems.length > 0) {
      throw new BusinessRuleError('CLAIM_NOT_VALID', 'The claim cannot be notified', problems);
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.claim.create({
        data: {
          claimNo: await this.numbering.next(tx, 'claim'),
          policyId: policy.id,
          agentId: policy.agentId,
          agencyId: policy.agencyId,
          claimType: input.claimType,
          eventDate,
          description: input.description.trim(),
          claimedAmount: input.claimedAmount !== undefined ? money(input.claimedAmount) : null,
          submittedById: user.id,
        },
        include: CLAIM_INCLUDE,
      });
      await tx.policyEvent.create({
        data: {
          policyId: policy.id,
          action: 'CLAIM_NOTIFIED',
          remarks: claim.claimNo,
          ...currentActor(),
        },
      });
      await this.outbox.enqueue(
        tx,
        'CORE',
        CoreOperation.ClaimNotified,
        {
          claimNo: claim.claimNo,
          policyNo: policy.policyNo,
          claimType: claim.claimType,
          eventDate: input.eventDate,
          description: claim.description,
          claimedAmount: claim.claimedAmount?.toFixed(2) ?? null,
        },
        { type: 'Claim', id: claim.id },
      );
      await this.notifications.notifyPermissionHolders(tx, Permission.BoClaimsManage, {
        eventType: 'CLAIM_NOTIFIED',
        subject: `Claim ${claim.claimNo} notified`,
        body: `${claim.claimType} on ${policy.policyNo} reported by ${user.fullName}.`,
        link: `/backoffice/claims/${claim.id}`,
      });
      await this.audit.record(
        {
          action: 'CLAIM_NOTIFIED',
          entityType: 'Claim',
          entityId: claim.id,
          after: { claimNo: claim.claimNo },
        },
        tx,
      );
      return claim;
    });
  }

  async list(user: SessionUser, query: PageQueryDto, status?: ClaimStatus, search?: string) {
    const scope = await this.scopes.resolve(user);
    const term = search?.trim();
    const where: Prisma.ClaimWhereInput = {
      ...DataScopeService.recordFilter(scope),
      status,
      OR: term
        ? [
            { claimNo: { contains: term, mode: 'insensitive' } },
            { policy: { policyNo: { contains: term, mode: 'insensitive' } } },
            { policy: { participant: { fullName: { contains: term, mode: 'insensitive' } } } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.claim.findMany({
        where,
        include: CLAIM_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.claim.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async detail(user: SessionUser, id: string) {
    const scope = await this.scopes.resolve(user);
    const claim = await this.prisma.claim.findUnique({ where: { id }, include: CLAIM_INCLUDE });
    if (!claim || !DataScopeService.allows(scope, claim)) {
      throw notFound('Claim');
    }
    const documents = await this.documents.listForOwnerUnchecked(this.prisma, 'CLAIM', id);
    return { ...claim, documents };
  }

  async updateStatus(id: string, status: ClaimStatus, remarks: string) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.claim.findUnique({ where: { id } });
      if (!claim) {
        throw notFound('Claim');
      }
      if (!CLAIM_TRANSITIONS[claim.status].includes(status)) {
        throw new BusinessRuleError(
          'INVALID_STATUS_CHANGE',
          `A ${claim.status} claim cannot move to ${status}`,
        );
      }
      const updated = await tx.claim.update({
        where: { id },
        data: { status, remarks },
        include: CLAIM_INCLUDE,
      });
      await this.audit.record(
        {
          action: 'CLAIM_STATUS_CHANGED',
          entityType: 'Claim',
          entityId: id,
          before: { status: claim.status },
          after: { status, remarks },
        },
        tx,
      );
      await this.notifications.notifyUser(tx, claim.submittedById, {
        eventType: 'CLAIM_STATUS_CHANGED',
        subject: `Claim ${claim.claimNo}: ${status.replace('_', ' ').toLowerCase()}`,
        body: remarks,
        link: `/portal/claims/${id}`,
      });
      return updated;
    });
  }
}
