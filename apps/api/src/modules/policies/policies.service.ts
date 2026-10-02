import { ForbiddenException, Injectable } from '@nestjs/common';
import { currentActor } from '../../common/context/request-context.js';
import { FieldCryptoService, maskIdentifier } from '../../common/crypto/field-crypto.service.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, toPage } from '../../common/http/pagination.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { type DataScope, DataScopeService } from '../../common/security/data-scope.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { addDays, businessToday, parseIsoDate } from '../../common/util/dates.js';
import { money, sum } from '../../common/util/money.js';
import {
  type Nominee,
  type Participant,
  Prisma,
  type Product,
} from '../../generated/prisma/client.js';
import { AmlService } from '../aml/aml.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  evaluateQuestionnaire,
  type QuestionnaireAnswer,
  readQuestionnaire,
  readRequiredDocuments,
} from '../products/product-definitions.js';
import { ProductsService } from '../products/products.service.js';
import type { QuoteRequest, QuoteResult } from '../products/rating/rating.types.js';
import { MasterDataService } from '../settings/master-data.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import type {
  CalculateQuoteDto,
  CancellationDto,
  CreateQuotationDto,
  EndorsementDto,
  NomineeDto,
  PolicyQueryDto,
  QuoteOptionsDto,
} from './policy.dto.js';
import { type ContributionBreakdown, PolicyIssuanceService } from './policy-issuance.service.js';

/** Product-level rules held in product configuration next to the rating parameters. */
interface ProductRules {
  requiresNominee: boolean;
  qualityCheck: boolean;
}

function productRules(product: Product): ProductRules {
  const config = product.config as Record<string, unknown>;
  return {
    requiresNominee: config.requiresNominee === true,
    qualityCheck: config.qualityCheck === true,
  };
}

const LIST_SELECT = {
  id: true,
  quotationNo: true,
  policyNo: true,
  status: true,
  paymentStatus: true,
  sumCovered: true,
  contribution: true,
  outstandingAmount: true,
  paymentDueDate: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  issuedAt: true,
  product: { select: { id: true, code: true, name: true } },
  participant: { select: { id: true, participantNo: true, fullName: true } },
  agent: { select: { id: true, agentCode: true, fullName: true } },
  agency: { select: { id: true, code: true, name: true } },
} satisfies Prisma.PolicySelect;

@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly scopes: DataScopeService,
    private readonly products: ProductsService,
    private readonly issuance: PolicyIssuanceService,
    private readonly workflow: WorkflowService,
    private readonly documents: DocumentsService,
    private readonly aml: AmlService,
    private readonly settings: SettingsService,
    private readonly masterData: MasterDataService,
    private readonly notifications: NotificationsService,
    private readonly crypto: FieldCryptoService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Search and detail (AP-21..24, AP-30/31)
  // ---------------------------------------------------------------------------

  async search(user: SessionUser, query: PolicyQueryDto) {
    const scope = await this.scopes.resolve(user);
    const search = query.search?.trim();
    const where: Prisma.PolicyWhereInput = {
      AND: [
        DataScopeService.recordFilter(scope),
        {
          status: query.status,
          paymentStatus: query.paymentStatus,
          productId: query.productId,
          agencyId: scope.unrestricted ? query.agencyId : undefined,
          agentId: query.agentId,
          outstandingAmount: query.outstandingOnly ? { gt: 0 } : undefined,
          createdAt: {
            gte: query.from ? parseIsoDate(query.from) : undefined,
            lt: query.to ? addDays(parseIsoDate(query.to), 1) : undefined,
          },
          OR: search
            ? [
                { policyNo: { contains: search, mode: 'insensitive' } },
                { quotationNo: { contains: search, mode: 'insensitive' } },
                { participant: { fullName: { contains: search, mode: 'insensitive' } } },
              ]
            : undefined,
        },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.policy.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.policy.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async detail(user: SessionUser, id: string) {
    const scope = await this.scopes.resolve(user);
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: {
        product: true,
        participant: true,
        agent: { select: { id: true, agentCode: true, fullName: true, authorityLimit: true } },
        agency: { select: { id: true, code: true, name: true, issuanceBlocked: true } },
        nominees: true,
        events: { orderBy: { createdAt: 'asc' } },
        allocations: {
          include: {
            payment: {
              select: {
                id: true,
                paymentNo: true,
                status: true,
                paymentDate: true,
                method: true,
                referenceNo: true,
              },
            },
          },
        },
        receipts: { orderBy: { issuedAt: 'asc' } },
        claims: {
          select: { id: true, claimNo: true, claimType: true, status: true, eventDate: true },
        },
        signatures: {
          select: {
            id: true,
            recipientName: true,
            recipientEmail: true,
            expiresAt: true,
            signedAt: true,
            createdAt: true,
          },
        },
        renewalOf: { select: { id: true, policyNo: true } },
      },
    });
    if (!policy || !DataScopeService.allows(scope, policy)) {
      throw notFound('Policy');
    }
    const [documents, approvals] = await Promise.all([
      this.documents.listForOwnerUnchecked(this.prisma, 'POLICY', id),
      this.workflow.historyForEntity('Policy', id),
    ]);
    const required = readRequiredDocuments(policy.product.requiredDocuments)
      .filter((doc) => doc.mandatory)
      .map((doc) => doc.docType);
    const missingDocuments = await this.documents.missingTypes(this.prisma, 'POLICY', id, required);
    const { participant, nominees, ...rest } = policy;
    const { idNumberEnc, idNumberHash: _hash, ...participantView } = participant;
    return {
      ...rest,
      participant: {
        ...participantView,
        idNumberMasked: maskIdentifier(this.crypto.decrypt(idNumberEnc)),
      },
      nominees: nominees.map(({ idNumberEnc: nomineeId, ...nominee }) => ({
        ...nominee,
        idNumberMasked: nomineeId ? maskIdentifier(this.crypto.decrypt(nomineeId)) : null,
      })),
      documents,
      approvals,
      missingDocuments,
    };
  }

  // ---------------------------------------------------------------------------
  // Quotation (AP-18/19/20)
  // ---------------------------------------------------------------------------

  /** Indicative calculation without saving. */
  async calculate(user: SessionUser, input: CalculateQuoteDto): Promise<QuoteResult> {
    const product = await this.products.get(input.productId);
    const participant = await this.quotableParticipant(input.participantId);
    return this.rate(product, participant, input);
  }

  async createQuotation(user: SessionUser, input: CreateQuotationDto) {
    const agent = await this.activeAgent(user);
    const product = await this.products.get(input.productId);
    const participant = await this.quotableParticipant(input.participantId);
    const quote = this.rate(product, participant, input);

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.policy.create({
        data: {
          quotationNo: await this.numbering.next(tx, 'quotation'),
          productId: product.id,
          participantId: participant.id,
          agentId: agent.id,
          agencyId: agent.agencyId,
          createdById: user.id,
          startDate: input.startDate ? parseIsoDate(input.startDate) : null,
          ...this.quoteColumns(quote),
        },
      });
      await tx.policyEvent.create({
        data: {
          policyId: policy.id,
          action: 'QUOTATION_CREATED',
          toStatus: 'DRAFT',
          ...currentActor(),
        },
      });
      await this.audit.record(
        {
          action: 'QUOTATION_CREATED',
          entityType: 'Policy',
          entityId: policy.id,
          after: { quotationNo: policy.quotationNo, contribution: policy.contribution },
        },
        tx,
      );
      return policy;
    });
  }

  async updateQuotation(user: SessionUser, id: string, input: QuoteOptionsDto) {
    const policy = await this.editableQuotation(user, id);
    const participant = await this.prisma.participant.findUniqueOrThrow({
      where: { id: policy.participantId },
    });
    const quote = this.rate(policy.product, participant, input);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.policy.update({
        where: { id, version: policy.version },
        data: {
          startDate: input.startDate ? parseIsoDate(input.startDate) : null,
          ...this.quoteColumns(quote),
          version: { increment: 1 },
        },
      });
      await tx.policyEvent.create({
        data: { policyId: id, action: 'QUOTATION_UPDATED', ...currentActor() },
      });
      return updated;
    });
  }

  async saveQuestionnaire(user: SessionUser, id: string, answers: QuestionnaireAnswer[]) {
    const policy = await this.editableQuotation(user, id);
    evaluateQuestionnaire(readQuestionnaire(policy.product.questionnaire), answers);
    return this.prisma.policy.update({
      where: { id, version: policy.version },
      data: {
        questionnaire: answers as unknown as Prisma.InputJsonValue,
        version: { increment: 1 },
      },
    });
  }

  async saveNominees(user: SessionUser, id: string, nominees: NomineeDto[]) {
    const policy = await this.editableQuotation(user, id);
    await this.assertNominees(nominees);
    return this.prisma.$transaction(async (tx) => {
      const stored = await tx.nominee.findMany({ where: { policyId: id } });
      await tx.nominee.deleteMany({ where: { policyId: id } });
      await tx.nominee.createMany({ data: this.nomineeRows(id, nominees, stored) });
      await tx.policy.update({
        where: { id, version: policy.version },
        data: { version: { increment: 1 } },
      });
      return tx.nominee.count({ where: { policyId: id } });
    });
  }

  /** Discards a quotation that has not been issued (no approval needed). */
  async discardQuotation(user: SessionUser, id: string) {
    const policy = await this.ownedPolicy(user, id);
    if (
      !['DRAFT', 'PENDING_PAYMENT', 'REJECTED'].includes(policy.status) ||
      policy.paymentStatus !== 'UNPAID'
    ) {
      throw new BusinessRuleError(
        'CANNOT_DISCARD',
        'Only unpaid quotations that have not been issued can be discarded',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await this.issuance.changeStatus(
        tx,
        id,
        policy.status,
        'CANCELLED',
        'QUOTATION_DISCARDED',
        'Discarded by agent',
      );
      await tx.policy.update({
        where: { id },
        data: {
          cancelledAt: new Date(),
          cancellationReason: 'Quotation discarded',
          outstandingAmount: 0,
        },
      });
    });
  }

  /** AP-51: a rejected quotation can be revised and resubmitted. */
  async reopen(user: SessionUser, id: string) {
    const policy = await this.ownedPolicy(user, id);
    if (policy.status !== 'REJECTED') {
      throw new BusinessRuleError('NOT_REJECTED', 'Only rejected quotations can be reopened');
    }
    await this.prisma.$transaction((tx) =>
      this.issuance.changeStatus(tx, id, 'REJECTED', 'DRAFT', 'REOPENED', 'Reopened for revision'),
    );
  }

  // ---------------------------------------------------------------------------
  // Submission (AP-25, AP-32, AP-33, AP-36, AP-60)
  // ---------------------------------------------------------------------------

  async submit(user: SessionUser, id: string) {
    const policy = await this.editableQuotation(user, id);
    const agent = await this.activeAgent(user, policy.agentId);
    const participant = await this.prisma.participant.findUniqueOrThrow({
      where: { id: policy.participantId },
    });
    const rules = productRules(policy.product);
    const problems: string[] = [];

    const validityDays = await this.settings.getInt(Setting.QuotationValidityDays);
    if (addDays(policy.createdAt, validityDays) < new Date()) {
      throw new BusinessRuleError(
        'QUOTATION_EXPIRED',
        `Quotations are valid for ${validityDays} days. Please create a new quotation.`,
      );
    }
    if (agent.agency.issuanceBlocked) {
      throw new BusinessRuleError(
        'AGENCY_BLOCKED',
        'New business is blocked for your agency/bank because contribution payments are overdue. Submit the outstanding payments to continue.',
      );
    }

    // Rates may have changed since the quotation was saved: always re-rate on submission.
    const quote = this.rate(policy.product, participant, {
      planCode: policy.planCode ?? undefined,
      coverageType: policy.coverageType ?? undefined,
      termMonths: policy.termMonths,
      additionalCover: (policy.riskDetails as Record<string, unknown>).additionalCover === true,
      riskDetails: policy.riskDetails as Record<string, unknown>,
    });

    const referralReasons = [...quote.referralReasons];
    referralReasons.push(
      ...evaluateQuestionnaire(
        readQuestionnaire(policy.product.questionnaire),
        (policy.questionnaire ?? []) as unknown as QuestionnaireAnswer[],
      ),
    );

    const nominees = await this.prisma.nominee.findMany({ where: { policyId: id } });
    if (rules.requiresNominee && nominees.length === 0) {
      problems.push('At least one nominee, beneficiary or executor is required');
    }

    const mandatory = readRequiredDocuments(policy.product.requiredDocuments).filter(
      (doc) => doc.mandatory,
    );
    const missing = await this.documents.missingTypes(
      this.prisma,
      'POLICY',
      id,
      mandatory.map((doc) => doc.docType),
    );
    problems.push(
      ...mandatory
        .filter((doc) => missing.includes(doc.docType))
        .map((doc) => `Upload: ${doc.label}`),
    );

    if (await this.settings.getBool(Setting.RequireParticipantSignature)) {
      const signed = await this.prisma.document.count({
        where: {
          ownerType: 'POLICY',
          ownerId: id,
          docType: { in: ['SIGNATURE_PARTICIPANT', 'SIGNED_PROPOSAL_FORM'] },
        },
      });
      if (signed === 0)
        problems.push(
          'Participant signature is required (sign on screen, send an e-signature link or upload the signed proposal form)',
        );
    }
    if (problems.length > 0) {
      throw new BusinessRuleError(
        'SUBMISSION_INCOMPLETE',
        'The application is not ready for submission',
        problems,
      );
    }

    if (agent.authorityLimit && quote.sumCovered.greaterThan(agent.authorityLimit)) {
      referralReasons.push(
        `Sum covered exceeds your authority limit of B$${agent.authorityLimit.toFixed(2)}`,
      );
    }
    if (rules.qualityCheck) {
      referralReasons.push('Quality check by IIFT before contract issuance');
    }

    await this.ensureAmlClear(participant);

    return this.prisma.$transaction(async (tx) => {
      const submitted = await tx.policy.update({
        where: { id, version: policy.version },
        data: {
          ...this.quoteColumns(quote),
          referralReasons,
          submittedAt: new Date(),
          version: { increment: 1 },
        },
      });
      await tx.policyEvent.create({
        data: {
          policyId: id,
          action: 'SUBMITTED',
          fromStatus: 'DRAFT',
          toStatus: 'DRAFT',
          ...currentActor(),
        },
      });

      if (referralReasons.length > 0) {
        await this.issuance.changeStatus(
          tx,
          id,
          'DRAFT',
          'PENDING_APPROVAL',
          'REFERRED',
          referralReasons.join('; '),
        );
        await this.workflow.submit(tx, {
          type: 'POLICY_REFERRAL',
          entityType: 'Policy',
          entityId: id,
          agencyId: submitted.agencyId,
          amount: submitted.sumCovered,
          summary: `${policy.product.name} for ${participant.fullName} (${submitted.quotationNo}) – ${referralReasons.length} referral reason(s)`,
          payload: {
            quotationNo: submitted.quotationNo,
            product: policy.product.name,
            participant: participant.fullName,
            sumCovered: submitted.sumCovered.toFixed(2),
            contribution: submitted.contribution.toFixed(2),
            referralReasons,
          },
        });
      } else {
        await this.issuance.proceedAfterAcceptance(tx, id);
      }
      await this.audit.record(
        {
          action: 'POLICY_SUBMITTED',
          entityType: 'Policy',
          entityId: id,
          after: { referralReasons },
        },
        tx,
      );
      return tx.policy.findUniqueOrThrow({ where: { id }, select: LIST_SELECT });
    });
  }

  // ---------------------------------------------------------------------------
  // Servicing (AP-26/27/28)
  // ---------------------------------------------------------------------------

  /** AP-26: active or recently expired policies whose renewal is due. */
  async renewalsDue(user: SessionUser, query: PolicyQueryDto) {
    const scope = await this.scopes.resolve(user);
    const today = businessToday();
    const noticeDays = await this.settings.getInt(Setting.RenewalNoticeDays);
    const where: Prisma.PolicyWhereInput = {
      ...DataScopeService.recordFilter(scope),
      status: { in: ['ACTIVE', 'EXPIRED'] },
      product: { allowRenewal: true },
      endDate: { gte: addDays(today, -30), lte: addDays(today, noticeDays) },
      renewals: { none: { status: { notIn: ['CANCELLED', 'REJECTED'] } } },
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.policy.findMany({
        where,
        select: LIST_SELECT,
        orderBy: { endDate: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.policy.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async renew(user: SessionUser, id: string) {
    const source = await this.ownedPolicy(user, id);
    if (!['ACTIVE', 'EXPIRED'].includes(source.status)) {
      throw new BusinessRuleError(
        'NOT_RENEWABLE',
        'Only active or expired policies can be renewed',
      );
    }
    if (!source.product.allowRenewal) {
      throw new BusinessRuleError(
        'NOT_RENEWABLE',
        `${source.product.name} cannot be renewed through the portal`,
      );
    }
    const existing = await this.prisma.policy.count({
      where: { renewalOfId: id, status: { notIn: ['CANCELLED', 'REJECTED'] } },
    });
    if (existing > 0) {
      throw new BusinessRuleError(
        'RENEWAL_EXISTS',
        'A renewal quotation already exists for this policy',
      );
    }
    const startDate = source.endDate ? addDays(source.endDate, 1) : businessToday();
    const quotation = await this.createQuotation(user, {
      productId: source.productId,
      participantId: source.participantId,
      planCode: source.planCode ?? undefined,
      coverageType: source.coverageType ?? undefined,
      termMonths: source.termMonths,
      additionalCover: (source.riskDetails as Record<string, unknown>).additionalCover === true,
      startDate: startDate.toISOString().slice(0, 10),
      riskDetails: source.riskDetails as Record<string, unknown>,
    });
    const nominees = await this.prisma.nominee.findMany({ where: { policyId: id } });
    await this.prisma.$transaction(async (tx) => {
      await tx.policy.update({ where: { id: quotation.id }, data: { renewalOfId: id } });
      await tx.nominee.createMany({
        data: nominees.map(({ id: _id, policyId: _policyId, ...nominee }) => ({
          ...nominee,
          policyId: quotation.id,
        })),
      });
      await tx.policyEvent.create({
        data: {
          policyId: id,
          action: 'RENEWAL_QUOTED',
          remarks: `Renewal quotation ${quotation.quotationNo}`,
          ...currentActor(),
        },
      });
    });
    return quotation;
  }

  async requestEndorsement(user: SessionUser, id: string, input: EndorsementDto) {
    const policy = await this.ownedPolicy(user, id);
    if (policy.status !== 'ACTIVE') {
      throw new BusinessRuleError('NOT_ACTIVE', 'Only active policies can be endorsed');
    }
    await this.masterData.assertValid('ENDORSEMENT_TYPE', input.endorsementType);
    if (input.nominees) {
      await this.assertNominees(input.nominees);
    }
    const stored = input.nominees
      ? await this.prisma.nominee.findMany({ where: { policyId: id } })
      : [];
    return this.prisma.$transaction((tx) =>
      this.workflow.submit(tx, {
        type: 'POLICY_ENDORSEMENT',
        entityType: 'Policy',
        entityId: id,
        agencyId: policy.agencyId,
        summary: `Endorsement (${input.endorsementType}) on ${policy.policyNo}`,
        payload: {
          policyNo: policy.policyNo,
          endorsementType: input.endorsementType,
          description: input.description,
          nominees: input.nominees?.map(({ id: nomineeId, idNumber, ...nominee }) => {
            const idNumberEnc = this.nomineeIdNumber(nomineeId, idNumber, stored);
            return {
              ...nominee,
              idNumberEnc,
              idNumberMasked: idNumberEnc ? maskIdentifier(this.crypto.decrypt(idNumberEnc)) : null,
            };
          }),
        } as unknown as Prisma.InputJsonValue,
      }),
    );
  }

  async requestCancellation(user: SessionUser, id: string, input: CancellationDto) {
    const policy = await this.ownedPolicy(user, id);
    if (policy.status !== 'ACTIVE') {
      throw new BusinessRuleError(
        'NOT_ACTIVE',
        'Only active policies can be cancelled. Unissued quotations can be discarded.',
      );
    }
    await this.masterData.assertValid('CANCELLATION_REASON', input.reasonCode);
    const effectiveDate = parseIsoDate(input.effectiveDate);
    if (policy.startDate && effectiveDate < policy.startDate) {
      throw new BusinessRuleError(
        'INVALID_DATE',
        'Cancellation cannot take effect before the cover start date',
      );
    }
    return this.prisma.$transaction((tx) =>
      this.workflow.submit(tx, {
        type: 'POLICY_CANCELLATION',
        entityType: 'Policy',
        entityId: id,
        agencyId: policy.agencyId,
        amount: policy.contribution,
        summary: `Cancellation of ${policy.policyNo} (${input.reasonCode})`,
        payload: {
          policyNo: policy.policyNo,
          reasonCode: input.reasonCode,
          remarks: input.remarks,
          effectiveDate: input.effectiveDate,
        },
      }),
    );
  }

  /** AP-45: email the policy documents (schedule and receipts) to the participant. */
  async emailDocuments(user: SessionUser, id: string, email?: string) {
    const policy = await this.ownedPolicy(user, id);
    const recipient = email?.trim().toLowerCase() || policy.participant.email;
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new BusinessRuleError('EMAIL_REQUIRED', 'A valid e-mail address is required');
    }
    const documents = await this.prisma.document.findMany({
      where: { ownerType: 'POLICY', ownerId: id, docType: { in: ['POLICY_SCHEDULE', 'RECEIPT'] } },
      select: { id: true },
    });
    if (documents.length === 0) {
      throw new BusinessRuleError('NO_DOCUMENTS', 'There are no policy documents to send yet');
    }
    await this.prisma.$transaction(async (tx) => {
      await this.notifications.emailExternal(tx, recipient, {
        eventType: 'POLICY_DOCUMENTS',
        subject: `Policy documents – ${policy.policyNo ?? policy.quotationNo}`,
        body: `Dear ${policy.participant.fullName},\n\nPlease find attached your policy documents for ${policy.product.name}.`,
        attachmentIds: documents.map((d) => d.id),
      });
      await tx.policyEvent.create({
        data: {
          policyId: id,
          action: 'DOCUMENTS_EMAILED',
          remarks: `Sent to ${recipient}`,
          ...currentActor(),
        },
      });
    });
    return { sentTo: recipient, documents: documents.length };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private rate(product: Product, participant: Participant, input: QuoteOptionsDto): QuoteResult {
    const request: QuoteRequest = {
      planCode: input.planCode,
      coverageType: input.coverageType,
      termMonths: input.termMonths,
      additionalCover: input.additionalCover,
      riskDetails: input.riskDetails,
    };
    const startDate = input.startDate ? parseIsoDate(input.startDate) : businessToday();
    return this.products.quote(product, request, {
      participantType: participant.type,
      dateOfBirth: participant.dateOfBirth,
      nationality: participant.nationality,
      occupationClass: participant.occupationClass,
      startDate: startDate < businessToday() ? businessToday() : startDate,
    });
  }

  private quoteColumns(quote: QuoteResult) {
    const breakdown: ContributionBreakdown = {
      lines: quote.lines,
      tabarru: quote.tabarru.toFixed(2),
      wakalahFee: quote.wakalahFee.toFixed(2),
      commissionRate: quote.commissionRate,
    };
    return {
      planCode: quote.planCode,
      coverageType: quote.coverageType,
      termMonths: quote.termMonths,
      sumCovered: quote.sumCovered,
      contribution: quote.contribution,
      outstandingAmount: quote.contribution,
      contributionBreakdown: breakdown as unknown as Prisma.InputJsonValue,
      riskDetails: quote.riskDetails as Prisma.InputJsonValue,
      referralReasons: quote.referralReasons,
    };
  }

  private async assertNominees(nominees: NomineeDto[]): Promise<void> {
    if (nominees.length === 0) {
      return;
    }
    const total = sum(nominees.map((n) => n.sharePercent));
    if (!total.equals(100)) {
      throw new BusinessRuleError(
        'INVALID_SHARES',
        `Nominee shares must add up to 100% (currently ${total.toFixed(2)}%)`,
      );
    }
    for (const nominee of nominees) {
      await this.masterData.assertValid('RELATIONSHIP', nominee.relationship);
    }
  }

  private nomineeRows(policyId: string, nominees: NomineeDto[], stored: Nominee[]) {
    return nominees.map((n) => ({
      policyId,
      fullName: n.fullName.trim(),
      idNumberEnc: this.nomineeIdNumber(n.id, n.idNumber, stored),
      relationship: n.relationship,
      role: n.role,
      sharePercent: money(n.sharePercent),
    }));
  }

  /**
   * ID numbers are only ever returned masked, so a nominee that is resubmitted without
   * one keeps the encrypted value already stored against the same nominee id.
   */
  private nomineeIdNumber(
    nomineeId: string | undefined,
    idNumber: string | undefined,
    stored: Nominee[],
  ): string | null {
    if (idNumber) {
      return this.crypto.encrypt(idNumber.trim());
    }
    return stored.find((row) => row.id === nomineeId)?.idNumberEnc ?? null;
  }

  /** Portal users act on policies in their scope; back-office users on any policy. */
  private async ownedPolicy(user: SessionUser, id: string) {
    const scope: DataScope = await this.scopes.resolve(user);
    const policy = await this.prisma.policy.findUnique({
      where: { id },
      include: { product: true, participant: true },
    });
    if (!policy || !DataScopeService.allows(scope, policy)) {
      throw notFound('Policy');
    }
    return policy;
  }

  private async editableQuotation(user: SessionUser, id: string) {
    const policy = await this.ownedPolicy(user, id);
    if (policy.status !== 'DRAFT') {
      throw new BusinessRuleError('NOT_DRAFT', 'Only draft quotations can be changed');
    }
    return policy;
  }

  private async activeAgent(user: SessionUser, agentId = user.agentId) {
    if (user.audience !== 'PORTAL' || !agentId) {
      throw new ForbiddenException({
        code: 'PORTAL_ONLY',
        message: 'Quotations are created by agents and bank officers',
      });
    }
    const agent = await this.prisma.agent.findUniqueOrThrow({
      where: { id: agentId },
      include: { agency: true },
    });
    if (agent.status !== 'ACTIVE' || agent.agency.status !== 'ACTIVE') {
      throw new BusinessRuleError('AGENT_NOT_ACTIVE', 'The agent or agency is not active');
    }
    return agent;
  }

  /**
   * Any registered participant can be quoted (single shared profile, AP-11): agents reach
   * other agencies' participants only through the exact-ID lookup, and the full profile
   * becomes visible to the agency once it holds a policy for that participant.
   */
  private async quotableParticipant(participantId: string): Promise<Participant> {
    const participant = await this.prisma.participant.findUnique({ where: { id: participantId } });
    if (!participant) {
      throw notFound('Participant');
    }
    if (participant.amlStatus === 'REJECTED') {
      throw new BusinessRuleError(
        'AML_REJECTED',
        'This participant cannot be accepted (compliance decision)',
      );
    }
    return participant;
  }

  /**
   * Screens a participant not yet screened, then blocks while Compliance is reviewing.
   * The screening commits on its own so a flagged case reaches Compliance even though
   * the submission itself is refused.
   */
  private async ensureAmlClear(participant: Participant): Promise<void> {
    let status = participant.amlStatus;
    if (status === 'NOT_SCREENED') {
      status = (
        await this.prisma.$transaction((tx) =>
          this.aml.screen(tx, {
            type: 'PARTICIPANT',
            id: participant.id,
            name: participant.fullName,
            idNumber: this.crypto.decrypt(participant.idNumberEnc),
            dateOfBirth: participant.dateOfBirth,
            nationality: participant.nationality,
          }),
        )
      ).status;
    }
    if (status === 'FLAGGED') {
      throw new BusinessRuleError(
        'AML_REVIEW_PENDING',
        'The participant is under compliance review. Submission is possible once Compliance clears the case.',
      );
    }
    if (status === 'REJECTED') {
      throw new BusinessRuleError(
        'AML_REJECTED',
        'This participant cannot be accepted (compliance decision)',
      );
    }
  }
}
