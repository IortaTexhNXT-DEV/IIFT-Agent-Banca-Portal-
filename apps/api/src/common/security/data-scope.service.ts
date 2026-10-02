import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Permission } from './permissions.js';
import { hasPermission, type SessionUser } from './session-user.js';

/**
 * Which agencies/agents a user may see (AP-09, AP-12, AP-59).
 *
 *  - Back-office users: everything (`unrestricted`).
 *  - Portal users with "agency-wide" permission: every agent in their agency/bank.
 *  - Main agents: themselves and their sub-agents (two levels deep).
 *  - Everyone else: only their own records.
 */
export interface DataScope {
  unrestricted: boolean;
  agencyId?: string;
  agentIds?: string[];
}

export const UNRESTRICTED: DataScope = { unrestricted: true };

@Injectable()
export class DataScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: SessionUser): Promise<DataScope> {
    if (user.audience === 'BACKOFFICE') {
      return UNRESTRICTED;
    }
    if (!user.agentId || !user.agencyId) {
      throw new ForbiddenException({
        code: 'NO_AGENT_PROFILE',
        message: 'Your account is not linked to an agent profile',
      });
    }
    if (hasPermission(user, Permission.PortalAgencyWideView)) {
      return { unrestricted: false, agencyId: user.agencyId };
    }
    const subAgents = await this.prisma.agent.findMany({
      where: { OR: [{ parentAgentId: user.agentId }, { parent: { parentAgentId: user.agentId } }] },
      select: { id: true },
    });
    return {
      unrestricted: false,
      agencyId: user.agencyId,
      agentIds: [user.agentId, ...subAgents.map((a) => a.id)],
    };
  }

  /** Prisma filter for records that carry agencyId/agentId columns (policies, claims ...). */
  static recordFilter(scope: DataScope): { agencyId?: string; agentId?: { in: string[] } } {
    if (scope.unrestricted) {
      return {};
    }
    return {
      agencyId: scope.agencyId,
      agentId: scope.agentIds ? { in: scope.agentIds } : undefined,
    };
  }

  static allows(scope: DataScope, record: { agencyId: string; agentId?: string | null }): boolean {
    if (scope.unrestricted) {
      return true;
    }
    if (record.agencyId !== scope.agencyId) {
      return false;
    }
    return (
      !scope.agentIds ||
      (record.agentId !== undefined &&
        record.agentId !== null &&
        scope.agentIds.includes(record.agentId))
    );
  }
}
