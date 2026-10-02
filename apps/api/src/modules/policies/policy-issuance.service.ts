import { Injectable } from '@nestjs/common';
import { currentActor } from '../../common/context/request-context.js';
import { FieldCryptoService, maskIdentifier } from '../../common/crypto/field-crypto.service.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import { addDays, addMonths, businessToday, toIsoDate } from '../../common/util/dates.js';
import { money, ZERO } from '../../common/util/money.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PolicyStatus } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { formatDate, formatMoney, PdfRenderer } from '../documents/pdf-renderer.js';
import { CoreOperation, FinanceOperation, OutboxService } from '../integration/outbox.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import type { ContributionLine } from '../products/rating/rating.types.js';
import { describePlan } from '../products/plan-label.js';

export const POLICY_WITH_PARTIES = {
  product: true,
  participant: true,
  agent: true,
  agency: true,
  nominees: true,
} satisfies Prisma.PolicyInclude;

export type PolicyWithParties = Prisma.PolicyGetPayload<{ include: typeof POLICY_WITH_PARTIES }>;

/** Stored on the policy at quotation time; drives the schedule and commission. */
export interface ContributionBreakdown {
  lines: ContributionLine[];
  tabarru: string;
  wakalahFee: string;
  commissionRate: number;
}

/**
 * Issuance and payment application — the steps shared by direct submission, referral
 * approval and payment verification (FFR01..05 "issue e-Policy and e-Receipt").
 */
@Injectable()
export class PolicyIssuanceService {
  constructor(
    private readonly numbering: NumberingService,
    private readonly documents: DocumentsService,
    private readonly pdf: PdfRenderer,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    private readonly settings: SettingsService,
    private readonly crypto: FieldCryptoService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Called once a quotation has passed validation (and referral approval if needed).
   * Pay-first products wait for verified payment; banca financing products are issued
   * now and must be paid within the grace period (AP-42).
   */
  async proceedAfterAcceptance(tx: Prisma.TransactionClient, policyId: string): Promise<void> {
    const policy = await tx.policy.findUniqueOrThrow({
      where: { id: policyId },
      include: POLICY_WITH_PARTIES,
    });
    if (policy.product.paymentBeforeIssuance && !policy.outstandingAmount.isZero()) {
      await this.changeStatus(
        tx,
        policy.id,
        policy.status,
        'PENDING_PAYMENT',
        'AWAITING_PAYMENT',
        'Awaiting contribution payment before issuance',
      );
      await this.notifications.notifyAgent(tx, policy.agentId, {
        eventType: 'POLICY_AWAITING_PAYMENT',
        subject: `Quotation ${policy.quotationNo} accepted – payment required`,
        body: `Submit payment of ${formatMoney(policy.contribution)} to issue the e-Policy.`,
        link: `/portal/policies/${policy.id}`,
      });
      return;
    }
    await this.issue(tx, policy);
  }

  /** Applies a verified payment allocation to a policy and issues it if it was waiting. */
  async applyPayment(
    tx: Prisma.TransactionClient,
    policyId: string,
    amount: Prisma.Decimal,
  ): Promise<void> {
    const policy = await tx.policy.findUniqueOrThrow({
      where: { id: policyId },
      include: POLICY_WITH_PARTIES,
    });
    const outstanding = Prisma.Decimal.max(money(policy.outstandingAmount.minus(amount)), ZERO);
    const paid = outstanding.isZero();
    await tx.policy.update({
      where: { id: policyId },
      data: {
        outstandingAmount: outstanding,
        paymentStatus: paid ? 'PAID' : 'UNPAID',
        paymentDueDate: paid ? null : policy.paymentDueDate,
        version: { increment: 1 },
      },
    });
    await tx.policyEvent.create({
      data: {
        policyId,
        action: 'PAYMENT_APPLIED',
        remarks: `${formatMoney(amount)} received; outstanding ${formatMoney(outstanding)}`,
        ...currentActor(),
      },
    });
    if (paid && policy.status === 'PENDING_PAYMENT') {
      await this.issue(tx, { ...policy, outstandingAmount: outstanding, paymentStatus: 'PAID' });
    }
  }

  async renderSchedule(policy: PolicyWithParties): Promise<Buffer> {
    const breakdown = policy.contributionBreakdown as unknown as ContributionBreakdown;
    const risk = Object.entries(policy.riskDetails as Record<string, unknown>).map(
      ([key, value]) =>
        [humanise(key), typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)] as [
          string,
          string,
        ],
    );
    return this.pdf.render({
      title: 'e-Policy Schedule',
      reference: `Policy No. ${policy.policyNo}   |   Quotation No. ${policy.quotationNo}`,
      sections: [
        {
          heading: 'Certificate',
          fields: [
            ['Product', `${policy.product.name} (${policy.product.code})`],
            ['Line of business', policy.product.lineOfBusiness],
            [
              'Plan',
              describePlan(policy.product.config, policy.planCode, policy.coverageType) ?? '-',
            ],
            ['Period of cover', `${formatDate(policy.startDate)} to ${formatDate(policy.endDate)}`],
            ['Sum covered', formatMoney(policy.sumCovered)],
            ['Date of issue', formatDate(policy.issuedAt)],
          ],
        },
        {
          heading: 'Participant',
          fields: [
            ['Name', policy.participant.fullName],
            [
              'Identification',
              `${policy.participant.idType} ${maskIdentifier(this.crypto.decrypt(policy.participant.idNumberEnc))}`,
            ],
            ['Participant no.', policy.participant.participantNo],
            [
              'Address',
              [
                policy.participant.addressLine1,
                policy.participant.addressLine2,
                policy.participant.postcode,
                policy.participant.district,
              ]
                .filter(Boolean)
                .join(', '),
            ],
            [
              'Contact',
              [policy.participant.mobile, policy.participant.email].filter(Boolean).join(' / '),
            ],
          ],
        },
        {
          heading: 'Contribution',
          table: {
            columns: [
              { header: 'Item', width: 380 },
              { header: 'Amount', width: 115, align: 'right' },
            ],
            rows: [
              ...breakdown.lines.map((line) => [line.label, formatMoney(line.amount)]),
              [
                "of which Tabarru' (donation to the participants' risk fund)",
                formatMoney(breakdown.tabarru),
              ],
              ['of which Wakalah fee (operator fee)', formatMoney(breakdown.wakalahFee)],
              ['Total contribution', formatMoney(policy.contribution)],
            ],
          },
        },
        ...(policy.nominees.length > 0
          ? [
              {
                heading: 'Nominees / Beneficiaries',
                table: {
                  columns: [
                    { header: 'Name', width: 200 },
                    { header: 'Role', width: 100 },
                    { header: 'Relationship', width: 120 },
                    { header: 'Share', width: 75, align: 'right' as const },
                  ],
                  rows: policy.nominees.map((n) => [
                    n.fullName,
                    n.role,
                    n.relationship,
                    `${n.sharePercent.toFixed(2)}%`,
                  ]),
                },
              },
            ]
          : []),
        ...(risk.length > 0 ? [{ heading: 'Particulars', fields: risk }] : []),
        {
          heading: 'Distribution',
          fields: [
            ['Agent / Banker', `${policy.agent.fullName} (${policy.agent.agentCode})`],
            ['Agency / Bank', `${policy.agency.name} (${policy.agency.code})`],
          ],
          paragraphs: [
            'This certificate is issued under the Takaful contract between the participant and Insurans Islam Family Takaful Sendirian Berhad, ' +
              'subject to the terms, conditions and exclusions of the product. Please read the Product Disclosure Sheet and keep this document safe.',
          ],
        },
      ],
      footerNote: 'This e-Policy schedule is computer-produced and does not require a signature.',
    });
  }

  private async issue(tx: Prisma.TransactionClient, policy: PolicyWithParties): Promise<void> {
    const today = businessToday();
    const requestedStart = policy.startDate && policy.startDate > today ? policy.startDate : today;
    const endDate = addDays(addMonths(requestedStart, policy.termMonths), -1);
    const outstanding = policy.outstandingAmount;
    const graceDays = await this.settings.getInt(Setting.PaymentGraceDays);
    const policyNo = await this.numbering.nextPolicyNo(tx, policy.product.code);

    const issued = await tx.policy.update({
      where: { id: policy.id },
      data: {
        policyNo,
        status: 'ACTIVE',
        issuedAt: new Date(),
        startDate: requestedStart,
        endDate,
        paymentStatus: outstanding.isZero() ? 'PAID' : policy.paymentStatus,
        paymentDueDate: outstanding.isZero() ? null : addDays(today, graceDays),
        version: { increment: 1 },
      },
      include: POLICY_WITH_PARTIES,
    });
    await tx.policyEvent.create({
      data: {
        policyId: policy.id,
        action: 'ISSUED',
        fromStatus: policy.status,
        toStatus: 'ACTIVE',
        remarks: `Policy ${policyNo} issued`,
        ...currentActor(),
      },
    });

    const schedule = await this.documents.storeGenerated(tx, {
      ownerType: 'POLICY',
      ownerId: policy.id,
      docType: 'POLICY_SCHEDULE',
      fileName: `e-Policy-${policyNo.replace(/\//g, '-')}.pdf`,
      mimeType: 'application/pdf',
      content: await this.renderSchedule(issued),
    });

    await this.accrueCommission(tx, issued);
    await this.outbox.enqueue(
      tx,
      'CORE',
      CoreOperation.PolicyIssued,
      {
        policyNo,
        quotationNo: issued.quotationNo,
        productCode: issued.product.code,
        participantNo: issued.participant.participantNo,
        agentCode: issued.agent.agentCode,
        agencyCode: issued.agency.code,
        planCode: issued.planCode,
        coverageType: issued.coverageType,
        sumCovered: issued.sumCovered.toFixed(2),
        contribution: issued.contribution.toFixed(2),
        startDate: toIsoDate(requestedStart),
        endDate: toIsoDate(endDate),
        riskDetails: issued.riskDetails as Prisma.InputJsonValue,
      },
      { type: 'Policy', id: issued.id },
    );
    await this.audit.record(
      {
        action: 'POLICY_ISSUED',
        entityType: 'Policy',
        entityId: issued.id,
        after: { policyNo, status: 'ACTIVE' },
      },
      tx,
    );

    await this.notifications.notifyAgent(tx, issued.agentId, {
      eventType: 'POLICY_ISSUED',
      subject: `Policy ${policyNo} issued`,
      body:
        `${issued.product.name} for ${issued.participant.fullName} has been issued.` +
        (outstanding.isZero()
          ? ''
          : ` Contribution of ${formatMoney(outstanding)} is due by ${formatDate(addDays(today, graceDays))}.`),
      link: `/portal/policies/${issued.id}`,
      channels: ['EMAIL'],
    });
    if (issued.participant.email) {
      await this.notifications.emailExternal(tx, issued.participant.email, {
        eventType: 'E_POLICY',
        subject: `Your e-Policy ${policyNo} – ${issued.product.name}`,
        body: `Dear ${issued.participant.fullName},\n\nThank you for choosing Insurans Islam Family Takaful. Your e-Policy schedule is attached.`,
        attachmentIds: [schedule.id],
      });
    }
  }

  private async accrueCommission(
    tx: Prisma.TransactionClient,
    policy: PolicyWithParties,
  ): Promise<void> {
    const breakdown = policy.contributionBreakdown as unknown as ContributionBreakdown;
    const rate =
      breakdown.commissionRate ?? (await this.settings.getDecimal(Setting.DefaultCommissionRate));
    if (rate <= 0) {
      return;
    }
    const amount = money(policy.contribution.times(rate));
    const commission = await tx.commission.create({
      data: {
        agentId: policy.agentId,
        policyId: policy.id,
        period: toIsoDate(businessToday()).slice(0, 7),
        contribution: policy.contribution,
        rate: new Prisma.Decimal(rate),
        amount,
        source: 'PORTAL',
      },
    });
    await this.outbox.enqueue(
      tx,
      'FINANCE',
      FinanceOperation.CommissionAccrued,
      {
        policyNo: policy.policyNo,
        agentCode: policy.agent.agentCode,
        period: commission.period,
        rate,
        amount: amount.toFixed(2),
      },
      { type: 'Commission', id: commission.id },
    );
  }

  async changeStatus(
    tx: Prisma.TransactionClient,
    policyId: string,
    from: PolicyStatus,
    to: PolicyStatus,
    action: string,
    remarks?: string,
  ): Promise<void> {
    await tx.policy.update({
      where: { id: policyId },
      data: { status: to, version: { increment: 1 } },
    });
    await tx.policyEvent.create({
      data: { policyId, action, fromStatus: from, toStatus: to, remarks, ...currentActor() },
    });
  }
}

function humanise(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}
