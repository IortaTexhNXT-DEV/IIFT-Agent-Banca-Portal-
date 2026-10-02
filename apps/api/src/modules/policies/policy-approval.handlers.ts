import { Injectable, OnModuleInit } from '@nestjs/common';
import { currentActor } from '../../common/context/request-context.js';
import { BusinessRuleError } from '../../common/http/errors.js';
import { businessToday, daysBetween, parseIsoDate } from '../../common/util/dates.js';
import { money, ZERO } from '../../common/util/money.js';
import type { ApprovalRequest, Prisma } from '../../generated/prisma/client.js';
import type { NomineeRole } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { CoreOperation, FinanceOperation, OutboxService } from '../integration/outbox.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ApprovalHandler } from '../workflow/approval-handler.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import { POLICY_WITH_PARTIES, PolicyIssuanceService } from './policy-issuance.service.js';

/** AP-33/60: referred quotations (high-risk limit, authority limit, declarations, quality check). */
@Injectable()
export class PolicyReferralHandler implements ApprovalHandler, OnModuleInit {
  readonly type = 'POLICY_REFERRAL' as const;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly issuance: PolicyIssuanceService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const policy = await tx.policy.findUniqueOrThrow({
      where: { id: request.entityId },
      include: { agency: true },
    });
    if (policy.status !== 'PENDING_APPROVAL') {
      throw new BusinessRuleError('NOT_PENDING', 'This quotation is no longer awaiting approval');
    }
    await tx.policy.update({ where: { id: policy.id }, data: { approvedAt: new Date() } });
    await tx.policyEvent.create({
      data: {
        policyId: policy.id,
        action: 'REFERRAL_APPROVED',
        remarks: request.finalRemarks,
        ...currentActor(),
      },
    });
    await this.issuance.proceedAfterAcceptance(tx, policy.id);
  }

  async onRejected(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const policy = await tx.policy.update({
      where: { id: request.entityId },
      data: { rejectedReason: request.finalRemarks },
    });
    await this.issuance.changeStatus(
      tx,
      policy.id,
      'PENDING_APPROVAL',
      'REJECTED',
      'REFERRAL_REJECTED',
      request.finalRemarks ?? undefined,
    );
    await this.notifications.notifyAgent(tx, policy.agentId, {
      eventType: 'QUOTATION_REJECTED',
      subject: `Quotation ${policy.quotationNo} rejected`,
      body: `Reason: ${request.finalRemarks}. You may revise and resubmit the quotation.`,
      link: `/portal/policies/${policy.id}`,
      channels: ['EMAIL'],
    });
  }

  async onWithdrawn(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    await this.issuance.changeStatus(
      tx,
      request.entityId,
      'PENDING_APPROVAL',
      'DRAFT',
      'REFERRAL_WITHDRAWN',
      'Withdrawn by submitter',
    );
  }
}

interface EndorsementPayload {
  policyNo: string;
  endorsementType: string;
  description: string;
  nominees?: {
    fullName: string;
    idNumberEnc: string | null;
    relationship: string;
    role: NomineeRole;
    sharePercent: number;
  }[];
}

/** AP-27: endorsements are applied only after approval and produce a revised schedule. */
@Injectable()
export class PolicyEndorsementHandler implements ApprovalHandler, OnModuleInit {
  readonly type = 'POLICY_ENDORSEMENT' as const;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly issuance: PolicyIssuanceService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const payload = request.payload as unknown as EndorsementPayload;
    const policy = await tx.policy.findUniqueOrThrow({ where: { id: request.entityId } });
    if (policy.status !== 'ACTIVE') {
      throw new BusinessRuleError('NOT_ACTIVE', 'The policy is no longer active');
    }
    if (payload.nominees) {
      await tx.nominee.deleteMany({ where: { policyId: policy.id } });
      await tx.nominee.createMany({
        data: payload.nominees.map((n) => ({
          policyId: policy.id,
          fullName: n.fullName,
          idNumberEnc: n.idNumberEnc,
          relationship: n.relationship,
          role: n.role,
          sharePercent: money(n.sharePercent),
        })),
      });
    }
    await tx.policy.update({ where: { id: policy.id }, data: { version: { increment: 1 } } });
    await tx.policyEvent.create({
      data: {
        policyId: policy.id,
        action: 'ENDORSED',
        remarks: `${payload.endorsementType}: ${payload.description}`,
        ...currentActor(),
      },
    });

    const refreshed = await tx.policy.findUniqueOrThrow({
      where: { id: policy.id },
      include: POLICY_WITH_PARTIES,
    });
    await this.documents.storeGenerated(tx, {
      ownerType: 'POLICY',
      ownerId: policy.id,
      docType: 'POLICY_SCHEDULE',
      fileName: `e-Policy-${policy.policyNo!.replace(/\//g, '-')}-endorsed-${request.requestNo.replace(/\//g, '-')}.pdf`,
      mimeType: 'application/pdf',
      content: await this.issuance.renderSchedule(refreshed),
    });
    await this.outbox.enqueue(
      tx,
      'CORE',
      CoreOperation.PolicyEndorsed,
      {
        policyNo: policy.policyNo,
        endorsementType: payload.endorsementType,
        description: payload.description,
        reference: request.requestNo,
      },
      { type: 'Policy', id: policy.id },
    );
    await this.audit.record(
      {
        action: 'POLICY_ENDORSED',
        entityType: 'Policy',
        entityId: policy.id,
        after: { endorsementType: payload.endorsementType },
      },
      tx,
    );
  }

  async onRejected(): Promise<void> {
    // The endorsement was never applied.
  }
}

/** AP-28: cancellation with pro-rata refund of contribution for the unexpired period. */
@Injectable()
export class PolicyCancellationHandler implements ApprovalHandler, OnModuleInit {
  readonly type = 'POLICY_CANCELLATION' as const;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly issuance: PolicyIssuanceService,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const payload = request.payload as unknown as {
      reasonCode: string;
      remarks: string;
      effectiveDate: string;
    };
    const policy = await tx.policy.findUniqueOrThrow({ where: { id: request.entityId } });
    if (policy.status !== 'ACTIVE') {
      throw new BusinessRuleError('NOT_ACTIVE', 'The policy is no longer active');
    }
    const refund = this.refundAmount(policy, parseIsoDate(payload.effectiveDate));
    await tx.policy.update({
      where: { id: policy.id },
      data: {
        cancelledAt: new Date(),
        cancellationReason: `${payload.reasonCode}: ${payload.remarks}`,
        outstandingAmount: ZERO,
        paymentDueDate: null,
      },
    });
    await this.issuance.changeStatus(
      tx,
      policy.id,
      'ACTIVE',
      'CANCELLED',
      'CANCELLED',
      `Effective ${payload.effectiveDate}; refund B$${refund.toFixed(2)}`,
    );
    await this.outbox.enqueue(
      tx,
      'CORE',
      CoreOperation.PolicyCancelled,
      {
        policyNo: policy.policyNo,
        effectiveDate: payload.effectiveDate,
        reasonCode: payload.reasonCode,
      },
      { type: 'Policy', id: policy.id },
    );
    if (refund.greaterThan(0)) {
      await this.outbox.enqueue(
        tx,
        'FINANCE',
        FinanceOperation.RefundRequested,
        { policyNo: policy.policyNo, amount: refund.toFixed(2), reference: request.requestNo },
        { type: 'Policy', id: policy.id },
      );
    }
    await this.notifications.notifyAgent(tx, policy.agentId, {
      eventType: 'POLICY_CANCELLED',
      subject: `Policy ${policy.policyNo} cancelled`,
      body: `Cancellation approved, effective ${payload.effectiveDate}.${refund.greaterThan(0) ? ` Refund due: B$${refund.toFixed(2)}.` : ''}`,
      link: `/portal/policies/${policy.id}`,
    });
    await this.audit.record(
      {
        action: 'POLICY_CANCELLED',
        entityType: 'Policy',
        entityId: policy.id,
        after: { refund: refund.toFixed(2), ...payload },
      },
      tx,
    );
  }

  async onRejected(): Promise<void> {
    // The policy stays in force.
  }

  /** Refund only what was actually paid, pro-rated over the unexpired days of cover. */
  private refundAmount(
    policy: {
      startDate: Date | null;
      endDate: Date | null;
      contribution: Prisma.Decimal;
      outstandingAmount: Prisma.Decimal;
    },
    effective: Date,
  ) {
    if (!policy.startDate || !policy.endDate) {
      return ZERO;
    }
    const paid = policy.contribution.minus(policy.outstandingAmount);
    const totalDays = daysBetween(policy.startDate, policy.endDate) + 1;
    const effectiveDate = effective < businessToday() ? businessToday() : effective;
    const unexpiredDays = Math.max(0, daysBetween(effectiveDate, policy.endDate) + 1);
    return money(paid.times(unexpiredDays).dividedBy(totalDays));
  }
}

export const POLICY_HANDLERS = [
  PolicyReferralHandler,
  PolicyEndorsementHandler,
  PolicyCancellationHandler,
];
