import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import { Permission } from '../../common/security/permissions.js';
import { hasPermission, type SessionUser } from '../../common/security/session-user.js';
import type { DocumentOwnerType } from '../../generated/prisma/enums.js';

/** Owner types a portal user may attach documents to. */
const PORTAL_UPLOAD_OWNERS = new Set<DocumentOwnerType>([
  'AGENT',
  'PARTICIPANT',
  'POLICY',
  'PAYMENT',
  'CLAIM',
  'ISSUE',
]);

/**
 * Decides whether a user may read or attach documents for a given owner record.
 * Back-office users are authorised by permission at controller level; portal users
 * only reach documents of records inside their data scope.
 */
@Injectable()
export class DocumentAccess {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: DataScopeService,
  ) {}

  async assertCanRead(
    user: SessionUser,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<void> {
    if (!(await this.isAllowed(user, ownerType, ownerId))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have access to this document',
      });
    }
  }

  async assertCanUpload(
    user: SessionUser,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<void> {
    if (user.audience === 'PORTAL' && !PORTAL_UPLOAD_OWNERS.has(ownerType)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Documents cannot be attached to this record from the portal',
      });
    }
    await this.assertCanRead(user, ownerType, ownerId);
  }

  private async isAllowed(
    user: SessionUser,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<boolean> {
    if (user.audience === 'BACKOFFICE') {
      return true;
    }
    const scope = await this.scopes.resolve(user);
    const recordFilter = DataScopeService.recordFilter(scope);

    switch (ownerType) {
      case 'POLICY':
        return (await this.prisma.policy.count({ where: { id: ownerId, ...recordFilter } })) > 0;
      case 'CLAIM':
        return (await this.prisma.claim.count({ where: { id: ownerId, ...recordFilter } })) > 0;
      case 'PAYMENT':
        return (
          (await this.prisma.payment.count({ where: { id: ownerId, agencyId: scope.agencyId } })) >
          0
        );
      case 'AGENT':
        if (scope.agentIds && !scope.agentIds.includes(ownerId)) {
          return false;
        }
        return (
          (await this.prisma.agent.count({ where: { id: ownerId, agencyId: scope.agencyId } })) > 0
        );
      case 'PARTICIPANT':
        return this.canSeeParticipant(user, ownerId);
      case 'ISSUE':
        return (
          (await this.prisma.issue.count({ where: { id: ownerId, reportedById: user.id } })) > 0
        );
      default:
        return false;
    }
  }

  private async canSeeParticipant(user: SessionUser, participantId: string): Promise<boolean> {
    if (hasPermission(user, Permission.PortalCrossAgencyView)) {
      return true;
    }
    const count = await this.prisma.participant.count({
      where: {
        id: participantId,
        OR: [
          { createdByAgencyId: user.agencyId },
          { policies: { some: { agencyId: user.agencyId } } },
        ],
      },
    });
    return count > 0;
  }
}
