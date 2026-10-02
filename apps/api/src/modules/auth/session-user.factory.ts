import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { isKnownPermission, type PermissionCode } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';

/** Builds the session snapshot (identity, audience, effective permissions, agency link). */
@Injectable()
export class SessionUserFactory {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string, mustChangePassword: boolean): Promise<SessionUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        roles: { include: { role: { include: { permissions: true } } } },
        agent: { select: { id: true, agencyId: true } },
      },
    });

    const audience = user.userType === 'STAFF' ? 'BACKOFFICE' : 'PORTAL';
    const permissions = new Set<PermissionCode>();
    for (const { role } of user.roles) {
      if (role.audience !== audience) {
        continue;
      }
      for (const { permission } of role.permissions) {
        if (isKnownPermission(permission)) {
          permissions.add(permission);
        }
      }
    }

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      userType: user.userType,
      audience,
      permissions: [...permissions].sort(),
      agentId: user.agent?.id,
      agencyId: user.agent?.agencyId,
      mustChangePassword,
    };
  }
}
