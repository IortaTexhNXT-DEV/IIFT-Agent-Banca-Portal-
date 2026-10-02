import { ForbiddenException, Injectable } from '@nestjs/common';
import { requestContext } from '../../common/context/request-context.js';
import { BusinessRuleError, notFound, staleRecord } from '../../common/http/errors.js';
import { type Page, type PageQueryDto, pageArgs, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { isKnownPermission, type PermissionCode } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import type { DecimalInput } from '../../common/util/money.js';
import { type ApprovalRequest, Prisma } from '../../generated/prisma/client.js';
import type { ApprovalStatus, ApprovalType } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { type ApprovalHandler, backofficeLink } from './approval-handler.js';

export interface SubmitApproval {
  type: ApprovalType;
  entityType: string;
  entityId: string;
  summary: string;
  payload: Prisma.InputJsonValue;
  amount?: DecimalInput;
  agencyId?: string;
}

export interface WorkflowStepInput {
  name: string;
  permission: string;
  minAmount?: number | null;
}

export interface InboxFilter {
  type?: ApprovalType;
}

/**
 * Configurable approval workflow with maker-checker controls (COM-04, BO-10, BO-16..19,
 * AP-33, AP-60/61). Steps are defined per transaction type; a step can apply only above
 * an amount threshold (authority limits). Rules enforced server-side:
 *  - the maker can never approve their own request (segregation of duties);
 *  - the same person cannot approve two levels of one request;
 *  - rejection always requires remarks.
 */
@Injectable()
export class WorkflowService {
  private readonly handlers = new Map<ApprovalType, ApprovalHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  registerHandler(handler: ApprovalHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /**
   * Raises an approval request inside the caller's transaction. When no step applies
   * (workflow inactive, or amount below every threshold) the request is approved
   * immediately and the handler runs straight away.
   */
  async submit(tx: Prisma.TransactionClient, input: SubmitApproval): Promise<ApprovalRequest> {
    const maker = requestContext.current()?.user;
    if (!maker) {
      throw new Error('Approval requests must be raised by a signed-in user');
    }
    const pending = await tx.approvalRequest.count({
      where: {
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        status: 'PENDING',
      },
    });
    if (pending > 0) {
      throw new BusinessRuleError(
        'REQUEST_ALREADY_PENDING',
        'A request for this record is already awaiting approval',
      );
    }

    const permissions = await this.applicablePermissions(tx, input.type, input.amount);
    const requestNo = await this.nextRequestNo(tx);
    const autoApproved = permissions.length === 0;
    const request = await tx.approvalRequest.create({
      data: {
        requestNo,
        type: input.type,
        entityType: input.entityType,
        entityId: input.entityId,
        summary: input.summary,
        payload: input.payload,
        amount: input.amount !== undefined ? new Prisma.Decimal(input.amount) : null,
        status: autoApproved ? 'APPROVED' : 'PENDING',
        decidedAt: autoApproved ? new Date() : null,
        totalLevels: permissions.length,
        levelPermissions: permissions,
        makerId: maker.id,
        makerName: maker.fullName,
        agencyId: input.agencyId ?? maker.agencyId,
        actions: {
          create: { level: 0, action: 'SUBMIT', actorId: maker.id, actorName: maker.fullName },
        },
      },
    });
    await this.audit.record(
      {
        action: 'APPROVAL_SUBMITTED',
        entityType: input.entityType,
        entityId: input.entityId,
        after: { requestNo, type: input.type },
      },
      tx,
    );

    if (autoApproved) {
      await this.handlerFor(request.type).onApproved(request, tx);
    } else {
      await this.notifyApprovers(tx, request, permissions[0] as PermissionCode);
    }
    return request;
  }

  async approve(user: SessionUser, requestId: string, remarks?: string): Promise<ApprovalRequest> {
    return this.decide(user, requestId, 'APPROVE', remarks);
  }

  async reject(user: SessionUser, requestId: string, remarks: string): Promise<ApprovalRequest> {
    if (!remarks?.trim()) {
      throw new BusinessRuleError('REMARKS_REQUIRED', 'Please give the reason for rejection');
    }
    return this.decide(user, requestId, 'REJECT', remarks);
  }

  /** The maker may withdraw a request that has not been decided yet. */
  async withdraw(user: SessionUser, requestId: string): Promise<ApprovalRequest> {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.load(tx, requestId);
      if (request.makerId !== user.id) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Only the submitter can withdraw this request',
        });
      }
      const updated = await this.transition(tx, request, {
        status: 'WITHDRAWN',
        decidedAt: new Date(),
      });
      await tx.approvalAction.create({
        data: {
          requestId,
          level: request.currentLevel,
          action: 'WITHDRAW',
          actorId: user.id,
          actorName: user.fullName,
        },
      });
      await this.handlerFor(request.type).onWithdrawn?.(updated, tx);
      await this.audit.record(
        {
          action: 'APPROVAL_WITHDRAWN',
          entityType: request.entityType,
          entityId: request.entityId,
          after: { requestNo: request.requestNo },
        },
        tx,
      );
      return updated;
    });
  }

  /**
   * Closes the pending requests on a record whose subject has been rejected outside the
   * workflow, for example a confirmed AML match. Each is recorded as a rejection by the
   * user who made that decision, so handlers and notifications run as for a normal reject.
   */
  async rejectPendingFor(
    tx: Prisma.TransactionClient,
    user: SessionUser,
    entity: { entityType: string; entityId: string },
    remarks: string,
  ): Promise<number> {
    const pending = await tx.approvalRequest.findMany({ where: { ...entity, status: 'PENDING' } });
    for (const request of pending) {
      await tx.approvalAction.create({
        data: {
          requestId: request.id,
          level: request.currentLevel,
          action: 'REJECT',
          actorId: user.id,
          actorName: user.fullName,
          remarks,
        },
      });
      const updated = await this.transition(tx, request, {
        status: 'REJECTED',
        decidedAt: new Date(),
        finalRemarks: remarks,
      });
      await this.handlerFor(request.type).onRejected(updated, tx);
      await this.notifyMaker(tx, updated, 'rejected', remarks);
      await this.audit.record(
        {
          action: 'APPROVAL_REJECTED',
          entityType: request.entityType,
          entityId: request.entityId,
          before: { status: request.status, level: request.currentLevel },
          after: { status: updated.status, requestNo: request.requestNo, remarks },
        },
        tx,
      );
    }
    return pending.length;
  }

  /** Requests waiting for this user at their current level, excluding their own (BO-21). */
  async inbox(
    user: SessionUser,
    query: PageQueryDto,
    filter: InboxFilter,
  ): Promise<Page<ApprovalRequest>> {
    const permissions = user.permissions as string[];
    const typeFilter = filter.type ?? null;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT r.id FROM approval_request r
      WHERE r.status = 'PENDING'
        AND r.maker_id <> ${user.id}::uuid
        AND r.level_permissions[r.current_level] = ANY(${permissions}::text[])
        AND (${typeFilter}::text IS NULL OR r.type::text = ${typeFilter}::text)
        AND NOT EXISTS (
          SELECT 1 FROM approval_action a
          WHERE a.request_id = r.id AND a.actor_id = ${user.id}::uuid AND a.action = 'APPROVE')
      ORDER BY r.submitted_at ASC`;
    const ids = rows.map((row) => row.id);
    const items = await this.prisma.approvalRequest.findMany({
      where: { id: { in: ids } },
      orderBy: { submittedAt: 'asc' },
      ...pageArgs(query),
    });
    return toPage(items.map(withoutCiphertext), ids.length, query);
  }

  /** History/search for back-office users. */
  async search(
    query: PageQueryDto,
    filter: { type?: ApprovalType; status?: ApprovalStatus; requestNo?: string },
  ) {
    const where: Prisma.ApprovalRequestWhereInput = {
      type: filter.type,
      status: filter.status,
      requestNo: filter.requestNo ? { contains: filter.requestNo, mode: 'insensitive' } : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);
    return toPage(items.map(withoutCiphertext), total, query);
  }

  /** AP-49/50/51: requests the portal user (or their agency, if permitted) submitted. */
  async submittedBy(makerIds: string[], query: PageQueryDto, status?: ApprovalStatus) {
    const where: Prisma.ApprovalRequestWhereInput = { makerId: { in: makerIds }, status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        include: { actions: { orderBy: { createdAt: 'asc' } } },
        ...pageArgs(query),
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);
    return toPage(items.map(withoutCiphertext), total, query);
  }

  async detail(requestId: string) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { actions: { orderBy: { createdAt: 'asc' } } },
    });
    if (!request) {
      throw notFound('Approval request');
    }
    return withoutCiphertext(request);
  }

  async historyForEntity(entityType: string, entityId: string) {
    const requests = await this.prisma.approvalRequest.findMany({
      where: { entityType, entityId },
      orderBy: { submittedAt: 'desc' },
      include: { actions: { orderBy: { createdAt: 'asc' } } },
    });
    return requests.map(withoutCiphertext);
  }

  listDefinitions() {
    return this.prisma.workflowDefinition.findMany({
      orderBy: { type: 'asc' },
      include: { steps: { orderBy: { level: 'asc' } } },
    });
  }

  /** COM-04: reconfigure levels, approving permission and amount thresholds of a workflow. */
  async updateDefinition(type: ApprovalType, active: boolean, steps: WorkflowStepInput[]) {
    for (const step of steps) {
      if (!isKnownPermission(step.permission) || !step.permission.startsWith('bo.approve.')) {
        throw new BusinessRuleError(
          'INVALID_STEP_PERMISSION',
          `"${step.permission}" is not an approval permission`,
        );
      }
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.workflowDefinition.findUnique({
        where: { type },
        include: { steps: true },
      });
      if (!before) {
        throw notFound('Workflow');
      }
      await tx.workflowStep.deleteMany({ where: { definitionId: before.id } });
      const updated = await tx.workflowDefinition.update({
        where: { type },
        data: {
          active,
          steps: {
            create: steps.map((step, index) => ({
              level: index + 1,
              name: step.name.trim(),
              permission: step.permission,
              minAmount: step.minAmount ?? null,
            })),
          },
        },
        include: { steps: { orderBy: { level: 'asc' } } },
      });
      await this.audit.record(
        {
          action: 'WORKFLOW_UPDATED',
          entityType: 'WorkflowDefinition',
          entityId: type,
          before,
          after: updated,
        },
        tx,
      );
      return updated;
    });
  }

  private async decide(
    user: SessionUser,
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    remarks?: string,
  ): Promise<ApprovalRequest> {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.load(tx, requestId);
      await this.assertCanDecide(tx, user, request);

      await tx.approvalAction.create({
        data: {
          requestId,
          level: request.currentLevel,
          action: decision,
          actorId: user.id,
          actorName: user.fullName,
          remarks: remarks?.trim() || null,
        },
      });

      let updated: ApprovalRequest;
      if (decision === 'REJECT') {
        updated = await this.transition(tx, request, {
          status: 'REJECTED',
          decidedAt: new Date(),
          finalRemarks: remarks!.trim(),
        });
        await this.handlerFor(request.type).onRejected(updated, tx);
        await this.notifyMaker(tx, updated, 'rejected', remarks);
      } else if (request.currentLevel < request.totalLevels) {
        updated = await this.transition(tx, request, { currentLevel: request.currentLevel + 1 });
        await this.notifyApprovers(
          tx,
          updated,
          request.levelPermissions[request.currentLevel] as PermissionCode,
        );
      } else {
        updated = await this.transition(tx, request, {
          status: 'APPROVED',
          decidedAt: new Date(),
          finalRemarks: remarks?.trim() || null,
        });
        await this.handlerFor(request.type).onApproved(updated, tx);
        await this.notifyMaker(tx, updated, 'approved', remarks);
      }

      await this.audit.record(
        {
          action: decision === 'APPROVE' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
          entityType: request.entityType,
          entityId: request.entityId,
          before: { status: request.status, level: request.currentLevel },
          after: {
            status: updated.status,
            level: updated.currentLevel,
            requestNo: request.requestNo,
            remarks,
          },
        },
        tx,
      );
      return updated;
    });
  }

  private async assertCanDecide(
    tx: Prisma.TransactionClient,
    user: SessionUser,
    request: ApprovalRequest,
  ): Promise<void> {
    if (request.status !== 'PENDING') {
      throw new BusinessRuleError('REQUEST_NOT_PENDING', 'This request has already been decided');
    }
    if (request.makerId === user.id) {
      throw new BusinessRuleError(
        'SEGREGATION_OF_DUTIES',
        'You cannot approve or reject a request you submitted',
      );
    }
    const required = request.levelPermissions[request.currentLevel - 1];
    if (!(user.permissions as string[]).includes(required)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You are not an approver for this step',
      });
    }
    const alreadyApproved = await tx.approvalAction.count({
      where: { requestId: request.id, actorId: user.id, action: 'APPROVE' },
    });
    if (alreadyApproved > 0) {
      throw new BusinessRuleError(
        'SEGREGATION_OF_DUTIES',
        'You have already approved an earlier level of this request',
      );
    }
  }

  /** Optimistic transition: fails if another approver acted on the request concurrently. */
  private async transition(
    tx: Prisma.TransactionClient,
    request: ApprovalRequest,
    data: Prisma.ApprovalRequestUpdateManyMutationInput,
  ): Promise<ApprovalRequest> {
    const result = await tx.approvalRequest.updateMany({
      where: { id: request.id, status: 'PENDING', currentLevel: request.currentLevel },
      data,
    });
    if (result.count !== 1) {
      throw staleRecord('Approval request');
    }
    return tx.approvalRequest.findUniqueOrThrow({ where: { id: request.id } });
  }

  private async load(tx: Prisma.TransactionClient, requestId: string): Promise<ApprovalRequest> {
    const request = await tx.approvalRequest.findUnique({ where: { id: requestId } });
    if (!request) {
      throw notFound('Approval request');
    }
    return request;
  }

  private async applicablePermissions(
    tx: Prisma.TransactionClient,
    type: ApprovalType,
    amount?: DecimalInput,
  ): Promise<string[]> {
    const definition = await tx.workflowDefinition.findUnique({
      where: { type },
      include: { steps: { orderBy: { level: 'asc' } } },
    });
    if (!definition) {
      throw new Error(`Workflow definition for ${type} is missing`);
    }
    if (!definition.active) {
      return [];
    }
    const value = amount !== undefined ? new Prisma.Decimal(amount) : undefined;
    return definition.steps
      .filter(
        (step) =>
          step.minAmount === null ||
          (value !== undefined && value.greaterThanOrEqualTo(step.minAmount)),
      )
      .map((step) => step.permission);
  }

  private async nextRequestNo(tx: Prisma.TransactionClient): Promise<string> {
    const [row] = await tx.$queryRaw<
      { value: bigint }[]
    >`SELECT nextval('seq_request_no'::regclass) AS value`;
    return `RQ/${String(new Date().getFullYear()).slice(-2)}/${row.value.toString().padStart(6, '0')}`;
  }

  private handlerFor(type: ApprovalType): ApprovalHandler {
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new Error(`No approval handler registered for ${type}`);
    }
    return handler;
  }

  private async notifyApprovers(
    tx: Prisma.TransactionClient,
    request: ApprovalRequest,
    permission: PermissionCode,
  ): Promise<void> {
    await this.notifications.notifyPermissionHolders(
      tx,
      permission,
      {
        eventType: 'APPROVAL_PENDING',
        subject: `Approval required: ${request.requestNo}`,
        body: `${request.summary} (submitted by ${request.makerName}) is awaiting your approval.`,
        link: backofficeLink(request),
      },
      request.makerId,
    );
  }

  private async notifyMaker(
    tx: Prisma.TransactionClient,
    request: ApprovalRequest,
    outcome: 'approved' | 'rejected',
    remarks?: string,
  ): Promise<void> {
    await this.notifications.notifyUser(tx, request.makerId, {
      eventType: outcome === 'approved' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
      subject: `Request ${request.requestNo} ${outcome}`,
      body: `${request.summary} has been ${outcome}.${remarks ? ` Remarks: ${remarks}` : ''}`,
      link: `/requests/${request.id}`,
      channels: ['EMAIL'],
    });
  }
}

/**
 * Payloads may carry encrypted values (keys ending in "Enc") that the handler applies on
 * approval. They stay in the database but are never returned to clients.
 */
export function withoutCiphertext<T extends { payload: Prisma.JsonValue }>(request: T): T {
  return { ...request, payload: stripEncrypted(request.payload) };
}

function stripEncrypted(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) {
    return value.map(stripEncrypted);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.endsWith('Enc'))
        .map(([key, item]) => [key, stripEncrypted(item ?? null)]),
    );
  }
  return value;
}
