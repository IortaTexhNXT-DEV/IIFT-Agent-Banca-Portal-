import { Injectable } from '@nestjs/common';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { isKnownPermission, permissionAudience } from '../../common/security/permissions.js';
import type { Audience } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth/session.service.js';
import type { CreateRoleDto, RoleDto } from './access.dto.js';

/** BO-04: roles are built from the permission catalogue, per audience. */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  async list() {
    const roles = await this.prisma.role.findMany({
      orderBy: [{ audience: 'asc' }, { name: 'asc' }],
      include: { permissions: true, _count: { select: { users: true } } },
    });
    return roles.map(({ permissions, _count, ...role }) => ({
      ...role,
      permissions: permissions.map((p) => p.permission).sort(),
      userCount: _count.users,
    }));
  }

  async create(input: CreateRoleDto) {
    this.assertPermissions(input.audience, input.permissions);
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code: input.code,
          name: input.name.trim(),
          description: input.description?.trim(),
          audience: input.audience,
          permissions: {
            create: [...new Set(input.permissions)].map((permission) => ({ permission })),
          },
        },
      });
      await this.audit.record(
        { action: 'ROLE_CREATED', entityType: 'Role', entityId: role.id, after: input },
        tx,
      );
      return role;
    });
  }

  async update(id: string, input: RoleDto) {
    const before = await this.prisma.role.findUnique({
      where: { id },
      include: { permissions: true, users: true },
    });
    if (!before) {
      throw notFound('Role');
    }
    this.assertPermissions(before.audience, input.permissions);
    const role = await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      const saved = await tx.role.update({
        where: { id },
        data: {
          name: input.name.trim(),
          description: input.description?.trim(),
          permissions: {
            create: [...new Set(input.permissions)].map((permission) => ({ permission })),
          },
        },
      });
      await this.audit.record(
        {
          action: 'ROLE_UPDATED',
          entityType: 'Role',
          entityId: id,
          before: { permissions: before.permissions.map((p) => p.permission) },
          after: input,
        },
        tx,
      );
      return saved;
    });
    // Users pick up the new permission set at their next sign-in.
    for (const { userId } of before.users) {
      await this.sessions.revokeAllSessions(userId);
    }
    return role;
  }

  async remove(id: string): Promise<void> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) {
      throw notFound('Role');
    }
    if (role.isSystem) {
      throw new BusinessRuleError('SYSTEM_ROLE', 'System roles cannot be deleted');
    }
    if (role._count.users > 0) {
      throw new BusinessRuleError(
        'ROLE_IN_USE',
        'Remove the role from all users before deleting it',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({ where: { id } });
      await this.audit.record(
        { action: 'ROLE_DELETED', entityType: 'Role', entityId: id, before: { code: role.code } },
        tx,
      );
    });
  }

  private assertPermissions(audience: Audience, permissions: string[]): void {
    const invalid = permissions.filter(
      (code) => !isKnownPermission(code) || permissionAudience(code) !== audience,
    );
    if (invalid.length > 0) {
      throw new BusinessRuleError(
        'INVALID_PERMISSION',
        `Permissions not valid for a ${audience.toLowerCase()} role`,
        invalid,
      );
    }
  }
}
