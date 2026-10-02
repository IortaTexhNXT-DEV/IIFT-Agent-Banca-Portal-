import { Injectable, OnModuleInit } from '@nestjs/common';
import { BusinessRuleError, staleRecord } from '../../common/http/errors.js';
import { parseIsoDate } from '../../common/util/dates.js';
import type { Agent, ApprovalRequest, Prisma } from '../../generated/prisma/client.js';
import type { AgentStatus, AgentType } from '../../generated/prisma/enums.js';
import { UsersService } from '../access/users.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { CoreOperation, OutboxService } from '../integration/outbox.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ApprovalHandler } from '../workflow/approval-handler.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import { type AgentProfileChanges, AgentsService } from './agents.service.js';

/** Documents an applicant must have uploaded before registration can be approved. */
export const REQUIRED_AGENT_DOCUMENTS = ['IC_COPY'];

/** Portal role granted automatically when a registration is approved. */
const DEFAULT_PORTAL_ROLE: Record<AgentType, string> = {
  MAIN_AGENT: 'AGENCY_PRINCIPAL',
  SUB_AGENT: 'AGENT',
  BANKER: 'BANCA_OFFICER',
};

/** Shared steps after an agent record changes: sync to the core system. */
async function publishAgent(
  outbox: OutboxService,
  tx: Prisma.TransactionClient,
  agent: Agent,
): Promise<void> {
  await outbox.enqueue(
    tx,
    'CORE',
    CoreOperation.AgentUpsert,
    {
      agentCode: agent.agentCode,
      agencyId: agent.agencyId,
      agentType: agent.agentType,
      fullName: agent.fullName,
      status: agent.status,
      email: agent.email,
      mobile: agent.mobile,
      parentAgentId: agent.parentAgentId,
    },
    { type: 'Agent', id: agent.id },
  );
}

@Injectable()
export class AgentRegistrationHandler implements ApprovalHandler, OnModuleInit {
  readonly type = 'AGENT_REGISTRATION' as const;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly documents: DocumentsService,
    private readonly users: UsersService,
    private readonly outbox: OutboxService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const agent = await tx.agent.findUniqueOrThrow({ where: { id: request.entityId } });
    if (agent.status !== 'PENDING') {
      throw new BusinessRuleError('AGENT_NOT_PENDING', 'This registration is no longer pending');
    }
    if (agent.amlStatus !== 'CLEAR') {
      throw new BusinessRuleError(
        'AML_NOT_CLEARED',
        'AML screening must be cleared by Compliance before approval',
      );
    }
    const missing = await this.documents.missingTypes(
      tx,
      'AGENT',
      agent.id,
      REQUIRED_AGENT_DOCUMENTS,
    );
    if (missing.length > 0) {
      throw new BusinessRuleError(
        'DOCUMENTS_MISSING',
        'Required documents have not been uploaded',
        missing,
      );
    }

    const activated = await tx.agent.update({
      where: { id: agent.id },
      data: { status: 'ACTIVE', activatedAt: new Date(), version: { increment: 1 } },
    });
    await this.users.createPortalAccount(tx, {
      agentId: agent.id,
      username: agent.agentCode,
      fullName: agent.fullName,
      email: agent.email,
      mobile: agent.mobile,
      userType: agent.agentType === 'BANKER' ? 'BANCA' : 'AGENT',
      roleCode: DEFAULT_PORTAL_ROLE[agent.agentType],
    });
    await publishAgent(this.outbox, tx, activated);
    await this.audit.record(
      {
        action: 'AGENT_ACTIVATED',
        entityType: 'Agent',
        entityId: agent.id,
        before: { status: 'PENDING' },
        after: { status: 'ACTIVE' },
      },
      tx,
    );
    if (agent.parentAgentId) {
      await this.notifications.notifyAgent(tx, agent.parentAgentId, {
        eventType: 'AGENT_REGISTRATION_APPROVED',
        subject: `${agent.fullName} is now active`,
        body: `Registration of ${agent.fullName} (${agent.agentCode}) has been approved.`,
        link: '/portal/hierarchy',
      });
    }
  }

  async onRejected(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    await tx.agent.update({
      where: { id: request.entityId },
      data: { status: 'REJECTED', statusReason: request.finalRemarks, version: { increment: 1 } },
    });
  }

  async onWithdrawn(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    await tx.agent.update({
      where: { id: request.entityId },
      data: {
        status: 'REJECTED',
        statusReason: 'Registration withdrawn',
        version: { increment: 1 },
      },
    });
  }
}

@Injectable()
export class AgentProfileUpdateHandler implements ApprovalHandler, OnModuleInit {
  readonly type = 'AGENT_PROFILE_UPDATE' as const;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly agents: AgentsService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const { version, changes } = request.payload as unknown as {
      version: number;
      changes: AgentProfileChanges;
    };
    const agent = await tx.agent.findUniqueOrThrow({ where: { id: request.entityId } });
    if (agent.version !== version) {
      throw staleRecord('Agent profile');
    }
    if (changes.parentAgentId !== undefined) {
      await this.agents.assertValidParent(
        tx,
        agent.agentType,
        agent.agencyId,
        changes.parentAgentId,
        agent.id,
      );
    }
    const updated = await tx.agent.update({
      where: { id: agent.id },
      data: {
        fullName: changes.fullName,
        email: changes.email?.toLowerCase(),
        mobile: changes.mobile,
        address: changes.address,
        branchName: changes.branchName,
        licenceNo: changes.licenceNo,
        licenceExpiry: changes.licenceExpiry ? parseIsoDate(changes.licenceExpiry) : undefined,
        dateOfBirth: changes.dateOfBirth ? parseIsoDate(changes.dateOfBirth) : undefined,
        authorityLimit: changes.authorityLimit,
        parentAgentId: changes.parentAgentId,
        version: { increment: 1 },
      },
    });
    // Keep the login profile in step with the agent record.
    await tx.user.updateMany({
      where: { agentId: agent.id },
      data: {
        fullName: changes.fullName,
        email: changes.email?.toLowerCase(),
        mobile: changes.mobile,
      },
    });
    await publishAgent(this.outbox, tx, updated);
    await this.audit.record(
      {
        action: 'AGENT_UPDATED',
        entityType: 'Agent',
        entityId: agent.id,
        before: (request.payload as { before?: unknown }).before,
        after: changes,
      },
      tx,
    );
  }

  async onRejected(): Promise<void> {
    // Nothing to undo: the proposed changes were never applied.
  }
}

@Injectable()
export class AgentStatusChangeHandler implements ApprovalHandler, OnModuleInit {
  readonly type = 'AGENT_STATUS_CHANGE' as const;

  constructor(
    private readonly workflow: WorkflowService,
    private readonly outbox: OutboxService,
    private readonly sessions: SessionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.workflow.registerHandler(this);
  }

  async onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void> {
    const { from, to, reason, version } = request.payload as unknown as {
      from: AgentStatus;
      to: AgentStatus;
      reason: string;
      version: number;
    };
    const agent = await tx.agent.findUniqueOrThrow({
      where: { id: request.entityId },
      include: { user: true },
    });
    if (agent.version !== version || agent.status !== from) {
      throw staleRecord('Agent');
    }
    const updated = await tx.agent.update({
      where: { id: agent.id },
      data: {
        status: to,
        statusReason: reason,
        terminatedAt: to === 'TERMINATED' ? new Date() : undefined,
        version: { increment: 1 },
      },
    });
    if (agent.user) {
      await tx.user.update({
        where: { id: agent.user.id },
        data: { status: to === 'ACTIVE' ? 'ACTIVE' : 'DISABLED' },
      });
      if (to !== 'ACTIVE') {
        await this.sessions.revokeAllSessions(agent.user.id);
      } else {
        await this.notifications.notifyUser(tx, agent.user.id, {
          eventType: 'AGENT_REACTIVATED',
          subject: 'Your portal access has been restored',
          body: 'Your agent/banca status is active again.',
          channels: ['EMAIL'],
        });
      }
    }
    await publishAgent(this.outbox, tx, updated);
    await this.audit.record(
      {
        action: 'AGENT_STATUS_CHANGED',
        entityType: 'Agent',
        entityId: agent.id,
        before: { status: from },
        after: { status: to, reason },
      },
      tx,
    );
  }

  async onRejected(): Promise<void> {
    // Status remains unchanged.
  }
}
