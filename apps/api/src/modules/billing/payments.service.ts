import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { currentActor } from '../../common/context/request-context.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, toPage } from '../../common/http/pagination.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { addDays, businessToday, parseIsoDate } from '../../common/util/dates.js';
import { money, sum } from '../../common/util/money.js';
import type { ApprovalRequest, Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import type { UploadedFile } from '../documents/file-inspector.js';
import { formatDate, formatMoney, PdfRenderer } from '../documents/pdf-renderer.js';
import { FinanceOperation, OutboxService } from '../integration/outbox.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PolicyIssuanceService } from '../policies/policy-issuance.service.js';
import type { ApprovalHandler } from '../workflow/approval-handler.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import type { CommissionQueryDto, PaymentQueryDto, SubmitPaymentDto } from './billing.dto.js';
import { GracePeriodService } from './grace-period.service.js';

const PAYMENT_INCLUDE = {
  agency: { select: { id: true, code: true, name: true } },
  allocations: {
    include: {
      policy: {
        select: {
          id: true,
          policyNo: true,
          quotationNo: true,
          participant: { select: { fullName: true } },
        },
      },
    },
  },
  receipts: {
    select: {
      id: true,
      receiptNo: true,
      policyId: true,
      amount: true,
      issuedAt: true,
      documentId: true,
    },
  },
} satisfies Prisma.PaymentInclude;

/**
 * Billing (AP-37..41, BO payment verification). Agents submit single or bulk payments
 * with proof; Finance verifies them through the maker-checker workflow; verification
 * issues one e-Receipt per policy and posts it to the financial system.
 */
@Injectable()
export class PaymentsService implements ApprovalHandler, OnModuleInit {
  readonly type = 'PAYMENT_VERIFICATION' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly scopes: DataScopeService,
    private readonly documents: DocumentsService,
    private readonly pdf: PdfRenderer,
    private readonly issuance: PolicyIssuanceService,
    private readonly workflow: WorkflowService,
    private readonly gracePeriod: GracePeriodService,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  /** AP-37: outstanding contributions and payment statistics for the agent's scope. */
  async outstanding(user: SessionUser) {
    const scope = await this.scopes.resolve(user);
    const today = businessToday();
    const policies = await this.prisma.policy.findMany({
      where: {
        ...DataScopeService.recordFilter(scope),
        status: { in: ['ACTIVE', 'PENDING_PAYMENT'] },
        outstandingAmount: { gt: 0 },
      },
      select: {
        id: true,
        policyNo: true,
        quotationNo: true,
        status: true,
        paymentStatus: true,
        contribution: true,
        outstandingAmount: true,
        paymentDueDate: true,
        issuedAt: true,
        product: { select: { code: true, name: true } },
        participant: { select: { fullName: true } },
        agent: { select: { agentCode: true, fullName: true } },
      },
      orderBy: [{ paymentDueDate: 'asc' }, { createdAt: 'asc' }],
    });
    const awaiting = policies.filter((p) => p.paymentStatus === 'UNPAID');
    const overdue = awaiting.filter((p) => p.paymentDueDate && p.paymentDueDate < today);
    const dueSoon = awaiting.filter(
      (p) => p.paymentDueDate && p.paymentDueDate >= today && p.paymentDueDate <= addDays(today, 3),
    );
    const agency = scope.agencyId
      ? await this.prisma.agency.findUnique({ where: { id: scope.agencyId } })
      : null;
    return {
      summary: {
        outstandingCount: awaiting.length,
        outstandingAmount: sum(awaiting.map((p) => p.outstandingAmount)),
        overdueCount: overdue.length,
        overdueAmount: sum(overdue.map((p) => p.outstandingAmount)),
        dueSoonCount: dueSoon.length,
        pendingVerificationCount: policies.length - awaiting.length,
        issuanceBlocked: agency?.issuanceBlocked ?? false,
        blockReason: agency?.issuanceBlockReason ?? null,
      },
      policies: policies.map((p) => ({
        ...p,
        overdue: p.paymentStatus === 'UNPAID' && !!p.paymentDueDate && p.paymentDueDate < today,
      })),
    };
  }

  /** AP-38/39/40: single or bulk payment, allocated per policy, with proof of payment. */
  async submit(user: SessionUser, input: SubmitPaymentDto, proof: UploadedFile | undefined) {
    if (!user.agencyId) {
      throw new ForbiddenException({
        code: 'NO_AGENT_PROFILE',
        message: 'Your account is not linked to an agency',
      });
    }
    const paymentDate = parseIsoDate(input.paymentDate);
    if (paymentDate > businessToday()) {
      throw new BusinessRuleError('INVALID_DATE', 'Payment date cannot be in the future');
    }
    const policyIds = input.allocations.map((a) => a.policyId);
    if (new Set(policyIds).size !== policyIds.length) {
      throw new BusinessRuleError(
        'DUPLICATE_ALLOCATION',
        'Each policy can appear only once in a payment',
      );
    }
    const scope = await this.scopes.resolve(user);
    const policies = await this.prisma.policy.findMany({
      where: { id: { in: policyIds }, ...DataScopeService.recordFilter(scope) },
    });
    const problems: string[] = [];
    for (const allocation of input.allocations) {
      const policy = policies.find((p) => p.id === allocation.policyId);
      if (!policy) {
        problems.push('A selected policy is not available to you');
      } else if (
        policy.paymentStatus !== 'UNPAID' ||
        !['ACTIVE', 'PENDING_PAYMENT'].includes(policy.status)
      ) {
        problems.push(`${policy.policyNo ?? policy.quotationNo} is not awaiting payment`);
      } else if (money(allocation.amount).greaterThan(policy.outstandingAmount)) {
        problems.push(
          `${policy.policyNo ?? policy.quotationNo}: amount exceeds the outstanding ${formatMoney(policy.outstandingAmount)}`,
        );
      }
    }
    if (problems.length > 0) {
      throw new BusinessRuleError('INVALID_ALLOCATION', 'The payment cannot be accepted', problems);
    }
    if (!proof) {
      throw new BusinessRuleError('PROOF_REQUIRED', 'Please attach the proof of payment');
    }
    const preparedProof = await this.documents.prepareUpload('PAYMENT_PROOF', proof);

    const total = sum(input.allocations.map((a) => a.amount));
    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          paymentNo: await this.numbering.next(tx, 'payment'),
          agencyId: user.agencyId!,
          submittedById: user.id,
          method: input.method,
          bankName: input.bankName,
          referenceNo: input.referenceNo.trim(),
          paymentDate,
          totalAmount: total,
          remarks: input.remarks,
          allocations: {
            create: input.allocations.map((a) => ({
              policyId: a.policyId,
              amount: money(a.amount),
            })),
          },
        },
      });
      for (const allocation of input.allocations) {
        await tx.policy.update({
          where: { id: allocation.policyId },
          data: { paymentStatus: 'PENDING_VERIFICATION', version: { increment: 1 } },
        });
        await tx.policyEvent.create({
          data: {
            policyId: allocation.policyId,
            action: 'PAYMENT_SUBMITTED',
            remarks: `${created.paymentNo}: ${formatMoney(allocation.amount)}`,
            ...currentActor(),
          },
        });
      }
      await this.workflow.submit(tx, {
        type: 'PAYMENT_VERIFICATION',
        entityType: 'Payment',
        entityId: created.id,
        agencyId: created.agencyId,
        amount: total,
        summary: `Payment ${created.paymentNo} of ${formatMoney(total)} for ${input.allocations.length} policy(ies)`,
        payload: {
          paymentNo: created.paymentNo,
          method: created.method,
          referenceNo: created.referenceNo,
          paymentDate: input.paymentDate,
          total: total.toFixed(2),
          policies: policies.map((p) => p.policyNo ?? p.quotationNo),
        },
      });
      await this.audit.record(
        {
          action: 'PAYMENT_SUBMITTED',
          entityType: 'Payment',
          entityId: created.id,
          after: { paymentNo: created.paymentNo, total: total.toFixed(2) },
        },
        tx,
      );
      await this.documents.recordUpload(
        tx,
        user,
        { ownerType: 'PAYMENT', ownerId: created.id, docType: 'PAYMENT_PROOF' },
        preparedProof,
      );
      await this.gracePeriod.evaluateAgency(tx, created.agencyId);
      return created;
    });
    return this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: PAYMENT_INCLUDE,
    });
  }

  async list(user: SessionUser, query: PaymentQueryDto) {
    const scope = await this.scopes.resolve(user);
    const search = query.search?.trim();
    // Agents without agency-wide visibility see the payments submitted by their own team.
    const teamUserIds = scope.agentIds
      ? (
          await this.prisma.user.findMany({
            where: { agentId: { in: scope.agentIds } },
            select: { id: true },
          })
        ).map((u) => u.id)
      : undefined;
    const where: Prisma.PaymentWhereInput = {
      agencyId: scope.unrestricted ? query.agencyId : scope.agencyId,
      submittedById: teamUserIds ? { in: teamUserIds } : undefined,
      status: query.status,
      OR: search
        ? [
            { paymentNo: { contains: search, mode: 'insensitive' } },
            { referenceNo: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        include: PAYMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.payment.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async detail(user: SessionUser, id: string) {
    const scope = await this.scopes.resolve(user);
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: PAYMENT_INCLUDE,
    });
    if (!payment || (!scope.unrestricted && payment.agencyId !== scope.agencyId)) {
      throw notFound('Payment');
    }
    const [documents, approvals] = await Promise.all([
      this.documents.listForOwnerUnchecked(this.prisma, 'PAYMENT', id),
      this.workflow.historyForEntity('Payment', id),
    ]);
    return { ...payment, documents, approvals };
  }

  /** INT-05: commission / referral fee of the agents in scope. */
  async commissions(user: SessionUser, query: CommissionQueryDto) {
    const scope = await this.scopes.resolve(user);
    const where: Prisma.CommissionWhereInput = {
      period: query.period,
      agent: scope.unrestricted
        ? undefined
        : { agencyId: scope.agencyId, id: scope.agentIds ? { in: scope.agentIds } : undefined },
    };
    const [items, total, totals] = await this.prisma.$transaction([
      this.prisma.commission.findMany({
        where,
        include: {
          agent: { select: { agentCode: true, fullName: true } },
          policy: { select: { policyNo: true, product: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.commission.count({ where }),
      this.prisma.commission.groupBy({
        by: ['status'],
        where,
        _sum: { amount: true },
        orderBy: { status: 'asc' },
      }),
    ]);
    return {
      ...toPage(items, total, query),
      totals: Object.fromEntries(totals.map((row) => [row.status, row._sum?.amount ?? 0])),
    };
  }

  // -- Verification outcome (maker-checker) -----------------------------------

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const payment = await tx.payment.findUniqueOrThrow({
      where: { id: request.entityId },
      include: { allocations: true, agency: true },
    });
    if (payment.status !== 'PENDING_VERIFICATION') {
      throw new BusinessRuleError('NOT_PENDING', 'This payment has already been processed');
    }
    const actor = currentActor();
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'VERIFIED', verifiedById: actor.actorId, verifiedAt: new Date() },
    });

    const receiptIds: string[] = [];
    for (const allocation of payment.allocations) {
      const receipt = await this.issueReceipt(tx, payment, allocation.policyId, allocation.amount);
      receiptIds.push(receipt.documentId);
      await this.issuance.applyPayment(tx, allocation.policyId, allocation.amount);
    }
    await this.gracePeriod.evaluateAgency(tx, payment.agencyId);
    await this.audit.record(
      {
        action: 'PAYMENT_VERIFIED',
        entityType: 'Payment',
        entityId: payment.id,
        after: { receipts: receiptIds.length },
      },
      tx,
    );
    await this.notifications.notifyUser(tx, payment.submittedById, {
      eventType: 'PAYMENT_VERIFIED',
      subject: `Payment ${payment.paymentNo} verified`,
      body: `${formatMoney(payment.totalAmount)} has been verified and ${receiptIds.length} e-Receipt(s) issued.`,
      link: `/portal/billing/payments/${payment.id}`,
      channels: ['EMAIL'],
      attachmentIds: receiptIds,
    });
  }

  async onRejected(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const payment = await tx.payment.update({
      where: { id: request.entityId },
      data: { status: 'REJECTED', rejectionReason: request.finalRemarks },
      include: { allocations: true },
    });
    for (const allocation of payment.allocations) {
      await tx.policy.update({
        where: { id: allocation.policyId },
        data: { paymentStatus: 'UNPAID', version: { increment: 1 } },
      });
      await tx.policyEvent.create({
        data: {
          policyId: allocation.policyId,
          action: 'PAYMENT_REJECTED',
          remarks: `${payment.paymentNo}: ${request.finalRemarks}`,
          ...currentActor(),
        },
      });
    }
    await this.gracePeriod.evaluateAgency(tx, payment.agencyId);
  }

  async onWithdrawn(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    await this.onRejected({ ...request, finalRemarks: 'Withdrawn by submitter' }, tx);
  }

  /** AP-41/44: one e-Receipt per policy, stored with the policy and posted to FIN. */
  private async issueReceipt(
    tx: Prisma.TransactionClient,
    payment: Prisma.PaymentGetPayload<{ include: { agency: true } }>,
    policyId: string,
    amount: Prisma.Decimal,
  ): Promise<{ documentId: string }> {
    const policy = await tx.policy.findUniqueOrThrow({
      where: { id: policyId },
      include: { participant: true, product: true },
    });
    const receiptNo = await this.numbering.next(tx, 'receipt');
    const content = await this.pdf.render({
      title: 'Official e-Receipt',
      reference: `Receipt No. ${receiptNo}`,
      sections: [
        {
          heading: 'Receipt',
          fields: [
            ['Date', formatDate(new Date())],
            ['Received from', `${payment.agency.name} on behalf of ${policy.participant.fullName}`],
            ['Amount received', formatMoney(amount)],
            [
              'Payment method',
              `${payment.method.replace(/_/g, ' ')}${payment.bankName ? ` – ${payment.bankName}` : ''}`,
            ],
            ['Payment reference', payment.referenceNo],
            ['Payment date', formatDate(payment.paymentDate)],
            ['Payment batch', payment.paymentNo],
          ],
        },
        {
          heading: 'Applied to',
          fields: [
            ['Policy / quotation', policy.policyNo ?? policy.quotationNo],
            ['Product', policy.product.name],
            ['Total contribution', formatMoney(policy.contribution)],
          ],
        },
      ],
      footerNote: 'This e-Receipt is computer-produced and valid without a signature.',
    });
    const document = await this.documents.storeGenerated(tx, {
      ownerType: 'POLICY',
      ownerId: policyId,
      docType: 'RECEIPT',
      fileName: `e-Receipt-${receiptNo.replace(/\//g, '-')}.pdf`,
      mimeType: 'application/pdf',
      content,
    });
    const receipt = await tx.receipt.create({
      data: { receiptNo, paymentId: payment.id, policyId, amount, documentId: document.id },
    });
    await this.outbox.enqueue(
      tx,
      'FINANCE',
      FinanceOperation.ReceiptPosted,
      {
        receiptNo,
        paymentNo: payment.paymentNo,
        policyNo: policy.policyNo,
        quotationNo: policy.quotationNo,
        productCode: policy.product.code,
        amount: amount.toFixed(2),
        method: payment.method,
        bankReference: payment.referenceNo,
        paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      },
      { type: 'Receipt', id: receipt.id },
    );
    return { documentId: document.id };
  }
}
