import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { FieldCryptoService, maskIdentifier } from '../../common/crypto/field-crypto.service.js';
import { BusinessRuleError, notFound, staleRecord } from '../../common/http/errors.js';
import { pageArgs, toPage } from '../../common/http/pagination.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import { Permission } from '../../common/security/permissions.js';
import { hasPermission, type SessionUser } from '../../common/security/session-user.js';
import { ageNextBirthday, businessToday, parseIsoDate } from '../../common/util/dates.js';
import type { ApprovalRequest, Participant, Prisma } from '../../generated/prisma/client.js';
import type { IdType } from '../../generated/prisma/enums.js';
import { AmlService } from '../aml/aml.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { CoreOperation, OutboxService } from '../integration/outbox.service.js';
import type { ApprovalHandler } from '../workflow/approval-handler.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import type {
  CreateParticipantDto,
  ParticipantQueryDto,
  UpdateParticipantDto,
} from './participant.dto.js';

/**
 * Participant management (AP-11..16). A participant has a single profile across all
 * agencies, keyed by identification number, so the same person is never duplicated.
 */
@Injectable()
export class ParticipantsService implements ApprovalHandler, OnModuleInit {
  readonly type = 'PARTICIPANT_UPDATE' as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldCryptoService,
    private readonly numbering: NumberingService,
    private readonly scopes: DataScopeService,
    private readonly aml: AmlService,
    private readonly workflow: WorkflowService,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async search(user: SessionUser, query: ParticipantQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.ParticipantWhereInput = {
      AND: [
        this.visibilityFilter(user),
        {
          type: query.type,
          amlStatus: query.amlStatus,
          idNumberHash: query.idNumber ? this.crypto.blindIndex(query.idNumber) : undefined,
          OR: search
            ? [
                { fullName: { contains: search, mode: 'insensitive' } },
                { participantNo: { contains: search, mode: 'insensitive' } },
                { mobile: { contains: search } },
              ]
            : undefined,
        },
      ],
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.participant.findMany({ where, orderBy: { fullName: 'asc' }, ...pageArgs(query) }),
      this.prisma.participant.count({ where }),
    ]);
    return toPage(
      items.map((p) => this.toView(p)),
      total,
      query,
    );
  }

  /**
   * AP-11: finds an existing profile by identification number anywhere in the
   * organisation, so the agent reuses it instead of creating a duplicate. Only a
   * minimal, masked summary is returned.
   */
  async lookup(idType: IdType, idNumber: string) {
    const participant = await this.prisma.participant.findUnique({
      where: { idType_idNumberHash: { idType, idNumberHash: this.crypto.blindIndex(idNumber) } },
    });
    if (!participant) {
      return { found: false as const };
    }
    return {
      found: true as const,
      participant: {
        id: participant.id,
        participantNo: participant.participantNo,
        fullName: participant.fullName,
        idNumberMasked: maskIdentifier(idNumber),
        amlStatus: participant.amlStatus,
      },
    };
  }

  async detail(user: SessionUser, id: string) {
    await this.assertVisible(user, id);
    const participant = await this.prisma.participant.findUnique({ where: { id } });
    if (!participant) {
      throw notFound('Participant');
    }
    const scope = await this.scopes.resolve(user);
    const crossAgency =
      user.audience === 'BACKOFFICE' || hasPermission(user, Permission.PortalCrossAgencyView);
    const [policies, documents, approvals, screenings] = await Promise.all([
      this.prisma.policy.findMany({
        where: { participantId: id, ...(crossAgency ? {} : DataScopeService.recordFilter(scope)) },
        select: {
          id: true,
          quotationNo: true,
          policyNo: true,
          status: true,
          paymentStatus: true,
          contribution: true,
          startDate: true,
          endDate: true,
          product: { select: { code: true, name: true } },
          agency: { select: { name: true } },
          agent: { select: { agentCode: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.documents.listForOwnerUnchecked(this.prisma, 'PARTICIPANT', id),
      this.workflow.historyForEntity('Participant', id),
      user.audience === 'BACKOFFICE' ? this.aml.historyFor('PARTICIPANT', id) : Promise.resolve([]),
    ]);
    return { ...this.toView(participant), policies, documents, approvals, screenings };
  }

  /** AP-13/16: register and screen. Flagged participants are routed to Compliance. */
  async create(user: SessionUser, input: CreateParticipantDto) {
    if (input.type === 'CORPORATE' && input.idType !== 'BUSINESS_REG') {
      throw new BusinessRuleError(
        'INVALID_ID_TYPE',
        'Corporate participants are identified by business registration number',
      );
    }
    if (input.type === 'INDIVIDUAL' && input.idType === 'BUSINESS_REG') {
      throw new BusinessRuleError(
        'INVALID_ID_TYPE',
        'Individuals are identified by IC or passport number',
      );
    }
    const idNumberHash = this.crypto.blindIndex(input.idNumber);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.participant.findUnique({
        where: { idType_idNumberHash: { idType: input.idType, idNumberHash } },
      });
      if (existing) {
        throw new BusinessRuleError(
          'DUPLICATE_PARTICIPANT',
          `This participant is already registered as ${existing.participantNo}`,
          [existing.id],
        );
      }
      const participant = await tx.participant.create({
        data: {
          participantNo: await this.numbering.next(tx, 'participant'),
          type: input.type,
          fullName: input.fullName.trim(),
          idType: input.idType,
          idNumberEnc: this.crypto.encrypt(input.idNumber.trim()),
          idNumberHash,
          dateOfBirth: input.dateOfBirth ? parseIsoDate(input.dateOfBirth) : null,
          gender: input.gender,
          nationality: input.nationality,
          occupation: input.occupation,
          occupationClass: input.occupationClass,
          email: input.email?.toLowerCase(),
          mobile: input.mobile,
          addressLine1: input.addressLine1.trim(),
          addressLine2: input.addressLine2?.trim(),
          postcode: input.postcode,
          district: input.district,
          contactPerson: input.contactPerson,
          createdByAgentId: user.agentId ?? null,
          createdByAgencyId: user.agencyId ?? null,
        },
      });
      await this.aml.screen(tx, {
        type: 'PARTICIPANT',
        id: participant.id,
        name: participant.fullName,
        idNumber: input.idNumber,
        dateOfBirth: participant.dateOfBirth,
        nationality: participant.nationality,
      });
      await this.audit.record(
        {
          action: 'PARTICIPANT_CREATED',
          entityType: 'Participant',
          entityId: participant.id,
          after: { participantNo: participant.participantNo, fullName: participant.fullName },
        },
        tx,
      );
      await this.publish(tx, participant.id);
      return this.toView(await tx.participant.findUniqueOrThrow({ where: { id: participant.id } }));
    });
  }

  /** AP-15: changes are applied only after approval. */
  async requestUpdate(user: SessionUser, id: string, changes: UpdateParticipantDto) {
    await this.assertVisible(user, id);
    const cleaned = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(cleaned).length === 0) {
      throw new BusinessRuleError('NO_CHANGES', 'No changes were submitted');
    }
    return this.prisma.$transaction(async (tx) => {
      const participant = await tx.participant.findUniqueOrThrow({ where: { id } });
      const before = Object.fromEntries(
        Object.keys(cleaned).map((key) => {
          const value = participant[key as keyof Participant];
          return [key, value instanceof Date ? value.toISOString().slice(0, 10) : (value ?? null)];
        }),
      );
      return this.workflow.submit(tx, {
        type: 'PARTICIPANT_UPDATE',
        entityType: 'Participant',
        entityId: id,
        summary: `Update participant ${participant.fullName} (${participant.participantNo})`,
        payload: {
          version: participant.version,
          changes: cleaned,
          before,
        } as Prisma.InputJsonValue,
      });
    });
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const { version, changes } = request.payload as unknown as {
      version: number;
      changes: UpdateParticipantDto;
    };
    const participant = await tx.participant.findUniqueOrThrow({ where: { id: request.entityId } });
    if (participant.version !== version) {
      throw staleRecord('Participant');
    }
    const updated = await tx.participant.update({
      where: { id: participant.id },
      data: {
        ...changes,
        email: changes.email?.toLowerCase(),
        dateOfBirth: changes.dateOfBirth ? parseIsoDate(changes.dateOfBirth) : undefined,
        version: { increment: 1 },
      },
    });
    if (changes.fullName && changes.fullName !== participant.fullName) {
      await this.aml.screen(tx, {
        type: 'PARTICIPANT',
        id: updated.id,
        name: updated.fullName,
        idNumber: this.crypto.decrypt(updated.idNumberEnc),
        dateOfBirth: updated.dateOfBirth,
        nationality: updated.nationality,
      });
    }
    await this.publish(tx, updated.id);
    await this.audit.record(
      {
        action: 'PARTICIPANT_UPDATED',
        entityType: 'Participant',
        entityId: updated.id,
        before: (request.payload as { before?: unknown }).before,
        after: changes,
      },
      tx,
    );
  }

  async onRejected(): Promise<void> {
    // The proposed changes were never applied.
  }

  /** Portal users see participants of their agency; cross-agency permission sees all (AP-11/12). */
  private visibilityFilter(user: SessionUser): Prisma.ParticipantWhereInput {
    if (user.audience === 'BACKOFFICE' || hasPermission(user, Permission.PortalCrossAgencyView)) {
      return {};
    }
    return {
      OR: [
        { createdByAgencyId: user.agencyId },
        { policies: { some: { agencyId: user.agencyId } } },
      ],
    };
  }

  async assertVisible(user: SessionUser, id: string): Promise<void> {
    const count = await this.prisma.participant.count({
      where: { AND: [{ id }, this.visibilityFilter(user)] },
    });
    if (count === 0) {
      const exists = await this.prisma.participant.count({ where: { id } });
      throw exists
        ? new ForbiddenException({
            code: 'FORBIDDEN',
            message: 'This participant is not shared with your agency',
          })
        : notFound('Participant');
    }
  }

  private async publish(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const participant = await tx.participant.findUniqueOrThrow({ where: { id } });
    await this.outbox.enqueue(
      tx,
      'CORE',
      CoreOperation.ParticipantUpsert,
      {
        participantNo: participant.participantNo,
        type: participant.type,
        fullName: participant.fullName,
        idType: participant.idType,
        idNumber: this.crypto.decrypt(participant.idNumberEnc),
        dateOfBirth: participant.dateOfBirth?.toISOString().slice(0, 10) ?? null,
        mobile: participant.mobile,
        email: participant.email,
        address: [
          participant.addressLine1,
          participant.addressLine2,
          participant.postcode,
          participant.district,
        ]
          .filter(Boolean)
          .join(', '),
      },
      { type: 'Participant', id },
    );
  }

  toView(participant: Participant) {
    const { idNumberEnc, idNumberHash: _hash, ...rest } = participant;
    return {
      ...rest,
      idNumberMasked: maskIdentifier(this.crypto.decrypt(idNumberEnc)),
      ageNextBirthday: participant.dateOfBirth
        ? ageNextBirthday(participant.dateOfBirth, businessToday())
        : null,
    };
  }
}
