import { ForbiddenException, Injectable } from '@nestjs/common';
import { FieldCryptoService, maskIdentifier } from '../../common/crypto/field-crypto.service.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, toPage } from '../../common/http/pagination.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import { Permission } from '../../common/security/permissions.js';
import { hasPermission, type SessionUser } from '../../common/security/session-user.js';
import { parseIsoDate } from '../../common/util/dates.js';
import { type Agent, Prisma } from '../../generated/prisma/client.js';
import type { AgentStatus } from '../../generated/prisma/enums.js';
import { AmlService } from '../aml/aml.service.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { WorkflowService } from '../workflow/workflow.service.js';
import type {
  AgentContactDto,
  AgentQueryDto,
  AgentStatusChangeDto,
  BackofficeRegisterAgentDto,
  RegisterAgentDto,
  UpdateAgentDto,
} from './agency.dto.js';

/** Status changes allowed from each status (BO-07). PENDING is left only through registration approval. */
export const ALLOWED_STATUS_CHANGES: Record<AgentStatus, AgentStatus[]> = {
  PENDING: [],
  ACTIVE: ['INACTIVE', 'SUSPENDED', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
  REJECTED: [],
};

const AGENT_INCLUDE = {
  agency: {
    select: {
      id: true,
      code: true,
      name: true,
      channel: true,
      status: true,
      issuanceBlocked: true,
    },
  },
  parent: { select: { id: true, agentCode: true, fullName: true } },
  user: { select: { id: true, username: true, status: true, lastLoginAt: true } },
} satisfies Prisma.AgentInclude;

type AgentWithRelations = Prisma.AgentGetPayload<{ include: typeof AGENT_INCLUDE }>;

export interface AgentProfileChanges {
  fullName?: string;
  email?: string;
  mobile?: string;
  address?: string;
  branchName?: string;
  licenceNo?: string;
  licenceExpiry?: string;
  dateOfBirth?: string;
  authorityLimit?: number | null;
  parentAgentId?: string | null;
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldCryptoService,
    private readonly numbering: NumberingService,
    private readonly scopes: DataScopeService,
    private readonly aml: AmlService,
    private readonly workflow: WorkflowService,
    private readonly documents: DocumentsService,
    private readonly audit: AuditService,
  ) {}

  /** BO-06: search by code, name, ID number (exact), agency, channel, status and type. */
  async search(
    query: AgentQueryDto,
    agencyRestriction?: { agencyId?: string; agentIds?: string[] },
  ) {
    const search = query.search?.trim();
    const where: Prisma.AgentWhereInput = {
      agencyId: agencyRestriction?.agencyId ?? query.agencyId,
      id: agencyRestriction?.agentIds ? { in: agencyRestriction.agentIds } : undefined,
      status: query.status,
      agentType: query.agentType,
      agency: query.channel ? { channel: query.channel } : undefined,
      idNumberHash: query.idNumber ? this.crypto.blindIndex(query.idNumber) : undefined,
      OR: search
        ? [
            { agentCode: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.agent.findMany({
        where,
        include: AGENT_INCLUDE,
        orderBy: { agentCode: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.agent.count({ where }),
    ]);
    return toPage(
      items.map((agent) => this.toView(agent)),
      total,
      query,
    );
  }

  async detail(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        ...AGENT_INCLUDE,
        subAgents: {
          select: { id: true, agentCode: true, fullName: true, status: true, agentType: true },
        },
      },
    });
    if (!agent) {
      throw notFound('Agent');
    }
    const [documents, screenings, approvals] = await Promise.all([
      this.documents.listForOwnerUnchecked(this.prisma, 'AGENT', id),
      this.aml.historyFor('AGENT', id),
      this.workflow.historyForEntity('Agent', id),
    ]);
    return { ...this.toView(agent), subAgents: agent.subAgents, documents, screenings, approvals };
  }

  /** AP-05: the signed-in agent's own profile. */
  async ownProfile(user: SessionUser) {
    if (!user.agentId) {
      throw new ForbiddenException({
        code: 'NO_AGENT_PROFILE',
        message: 'Your account is not linked to an agent profile',
      });
    }
    const detail = await this.detail(user.agentId);
    const { screenings: _screenings, ...profile } = detail;
    return profile;
  }

  /** AP-09: main/sub-agent/banker tree visible to the user. */
  async hierarchy(user: SessionUser) {
    const scope = await this.scopes.resolve(user);
    const agents = await this.prisma.agent.findMany({
      where: {
        agencyId: scope.agencyId,
        id: scope.agentIds ? { in: scope.agentIds } : undefined,
        status: { notIn: ['REJECTED'] },
      },
      select: {
        id: true,
        agentCode: true,
        fullName: true,
        agentType: true,
        status: true,
        parentAgentId: true,
        branchName: true,
      },
      orderBy: { agentCode: 'asc' },
    });
    type Node = (typeof agents)[number] & { children: Node[] };
    const nodes = new Map<string, Node>(
      agents.map((agent) => [agent.id, { ...agent, children: [] }]),
    );
    const roots: Node[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentAgentId ? nodes.get(node.parentAgentId) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /** AP-07 (portal, under the signed-in main agent / bank) and BO-05 (back-office). */
  async register(user: SessionUser, input: RegisterAgentDto | BackofficeRegisterAgentDto) {
    const agencyId = 'agencyId' in input ? input.agencyId : user.agencyId;
    if (!agencyId) {
      throw new ForbiddenException({
        code: 'NO_AGENT_PROFILE',
        message: 'Your account is not linked to an agency',
      });
    }
    let parentAgentId = input.parentAgentId;
    if (user.audience === 'PORTAL') {
      if (
        !hasPermission(user, Permission.PortalAgencyWideView) &&
        parentAgentId &&
        parentAgentId !== user.agentId
      ) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You can only register agents under yourself',
        });
      }
      parentAgentId ??= input.agentType === 'SUB_AGENT' ? user.agentId : undefined;
    }

    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.findUnique({ where: { id: agencyId } });
      if (!agency || agency.status !== 'ACTIVE') {
        throw new BusinessRuleError(
          'AGENCY_NOT_ACTIVE',
          'Agents can only be registered under an active agency/bank',
        );
      }
      this.assertTypeMatchesChannel(input.agentType, agency.channel);
      await this.assertValidParent(tx, input.agentType, agencyId, parentAgentId ?? null);

      const idNumberHash = this.crypto.blindIndex(input.idNumber);
      if (
        await tx.agent.findUnique({
          where: { idType_idNumberHash: { idType: input.idType, idNumberHash } },
        })
      ) {
        throw new BusinessRuleError(
          'DUPLICATE_AGENT',
          'An agent with this identification number is already registered',
        );
      }

      const agentCode = await this.numbering.nextAgentCode(
        tx,
        agency.channel === 'BANCA' ? 'BK' : 'AG',
      );
      const agent = await tx.agent.create({
        data: {
          agentCode,
          agencyId,
          agentType: input.agentType,
          parentAgentId: parentAgentId ?? null,
          fullName: input.fullName.trim(),
          idType: input.idType,
          idNumberEnc: this.crypto.encrypt(input.idNumber.trim()),
          idNumberHash,
          dateOfBirth: parseIsoDate(input.dateOfBirth),
          email: input.email.toLowerCase(),
          mobile: input.mobile,
          address: input.address,
          branchName: input.branchName,
          licenceNo: input.licenceNo,
          licenceExpiry: input.licenceExpiry ? parseIsoDate(input.licenceExpiry) : null,
          authorityLimit: input.authorityLimit ?? null,
        },
        include: AGENT_INCLUDE,
      });

      await this.aml.screen(tx, {
        type: 'AGENT',
        id: agent.id,
        name: agent.fullName,
        idNumber: input.idNumber,
        dateOfBirth: agent.dateOfBirth,
      });
      await this.audit.record(
        {
          action: 'AGENT_REGISTERED',
          entityType: 'Agent',
          entityId: agent.id,
          after: this.toView(agent),
        },
        tx,
      );
      await this.workflow.submit(tx, {
        type: 'AGENT_REGISTRATION',
        entityType: 'Agent',
        entityId: agent.id,
        agencyId,
        summary: `Registration of ${agent.fullName} (${agentCode}) – ${agency.name}`,
        payload: {
          agentCode,
          fullName: agent.fullName,
          agentType: agent.agentType,
          agency: agency.name,
          parent: agent.parent?.fullName ?? null,
          idNumber: maskIdentifier(input.idNumber),
          email: agent.email,
          mobile: agent.mobile,
        },
      });
      return this.toView(
        await tx.agent.findUniqueOrThrow({ where: { id: agent.id }, include: AGENT_INCLUDE }),
      );
    });
  }

  /** AP-06 (own contact details) and BO-05/08 (full profile and hierarchy) — maker-checker. */
  async requestProfileUpdate(
    user: SessionUser,
    agentId: string,
    changes: UpdateAgentDto | AgentContactDto,
  ) {
    const cleaned = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as AgentProfileChanges;
    if (Object.keys(cleaned).length === 0) {
      throw new BusinessRuleError('NO_CHANGES', 'No changes were submitted');
    }
    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.agent.findUnique({ where: { id: agentId }, include: AGENT_INCLUDE });
      if (!agent) {
        throw notFound('Agent');
      }
      if (agent.status === 'TERMINATED' || agent.status === 'REJECTED') {
        throw new BusinessRuleError(
          'AGENT_CLOSED',
          'Terminated or rejected agents cannot be updated',
        );
      }
      if (cleaned.parentAgentId !== undefined) {
        await this.assertValidParent(
          tx,
          agent.agentType,
          agent.agencyId,
          cleaned.parentAgentId,
          agent.id,
        );
      }
      const before = Object.fromEntries(
        Object.keys(cleaned).map((key) => [key, serialise(agent[key as keyof Agent])]),
      );
      return this.workflow.submit(tx, {
        type: 'AGENT_PROFILE_UPDATE',
        entityType: 'Agent',
        entityId: agent.id,
        agencyId: agent.agencyId,
        summary: `Profile update for ${agent.fullName} (${agent.agentCode})`,
        payload: {
          version: agent.version,
          changes: cleaned,
          before,
        } as unknown as Prisma.InputJsonValue,
      });
    });
  }

  /** BO-05/07: activate, suspend, deactivate or terminate — maker-checker. */
  async requestStatusChange(agentId: string, input: AgentStatusChangeDto) {
    return this.prisma.$transaction(async (tx) => {
      const agent = await tx.agent.findUnique({ where: { id: agentId } });
      if (!agent) {
        throw notFound('Agent');
      }
      if (!ALLOWED_STATUS_CHANGES[agent.status].includes(input.status)) {
        throw new BusinessRuleError(
          'INVALID_STATUS_CHANGE',
          `Status cannot change from ${agent.status} to ${input.status}`,
        );
      }
      return this.workflow.submit(tx, {
        type: 'AGENT_STATUS_CHANGE',
        entityType: 'Agent',
        entityId: agent.id,
        agencyId: agent.agencyId,
        summary: `Change status of ${agent.fullName} (${agent.agentCode}) from ${agent.status} to ${input.status}`,
        payload: {
          from: agent.status,
          to: input.status,
          reason: input.reason,
          version: agent.version,
        },
      });
    });
  }

  toView(agent: AgentWithRelations) {
    const { idNumberEnc, idNumberHash: _hash, ...rest } = agent;
    return { ...rest, idNumberMasked: maskIdentifier(this.crypto.decrypt(idNumberEnc)) };
  }

  private assertTypeMatchesChannel(
    agentType: Agent['agentType'],
    channel: 'AGENCY' | 'BANCA',
  ): void {
    const valid = channel === 'BANCA' ? agentType === 'BANKER' : agentType !== 'BANKER';
    if (!valid) {
      throw new BusinessRuleError(
        'INVALID_AGENT_TYPE',
        channel === 'BANCA'
          ? 'Banks register bank officers (BANKER)'
          : 'Agencies register main agents or sub-agents',
      );
    }
  }

  /** BO-08: sub-agents report to a main agent; bank officers may report to a senior bank officer. */
  async assertValidParent(
    db: Db,
    agentType: Agent['agentType'],
    agencyId: string,
    parentAgentId: string | null,
    selfId?: string,
  ): Promise<void> {
    if (agentType === 'SUB_AGENT' && !parentAgentId) {
      throw new BusinessRuleError('PARENT_REQUIRED', 'A sub-agent must be linked to a main agent');
    }
    if (agentType === 'MAIN_AGENT' && parentAgentId) {
      throw new BusinessRuleError('INVALID_PARENT', 'A main agent cannot report to another agent');
    }
    if (!parentAgentId) {
      return;
    }
    if (parentAgentId === selfId) {
      throw new BusinessRuleError('INVALID_PARENT', 'An agent cannot report to themselves');
    }
    const parent = await db.agent.findUnique({ where: { id: parentAgentId } });
    const expectedType = agentType === 'SUB_AGENT' ? 'MAIN_AGENT' : 'BANKER';
    if (
      !parent ||
      parent.agencyId !== agencyId ||
      parent.agentType !== expectedType ||
      parent.status !== 'ACTIVE'
    ) {
      throw new BusinessRuleError(
        'INVALID_PARENT',
        `The reporting line must be an active ${expectedType === 'MAIN_AGENT' ? 'main agent' : 'bank officer'} of the same agency/bank`,
      );
    }
    if (selfId && parent.parentAgentId === selfId) {
      throw new BusinessRuleError(
        'INVALID_PARENT',
        'This change would create a circular reporting line',
      );
    }
  }
}

function serialise(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  return value ?? null;
}
