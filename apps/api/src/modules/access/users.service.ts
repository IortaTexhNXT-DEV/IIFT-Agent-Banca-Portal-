import { Injectable } from '@nestjs/common';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, toPage } from '../../common/http/pagination.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Audience, UserType } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { PasswordService } from '../auth/password.service.js';
import { SessionService } from '../auth/session.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { CreateStaffUserDto, UpdateUserDto, UserQueryDto } from './access.dto.js';

const USER_SUMMARY = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  mobile: true,
  userType: true,
  status: true,
  authSource: true,
  lastLoginAt: true,
  lockedUntil: true,
  mustChangePassword: true,
  createdAt: true,
  agent: { select: { id: true, agentCode: true, agency: { select: { code: true, name: true } } } },
  roles: { select: { role: { select: { id: true, code: true, name: true } } } },
} satisfies Prisma.UserSelect;

export interface NewPortalAccount {
  agentId: string;
  username: string;
  fullName: string;
  email: string;
  mobile: string;
  userType: Extract<UserType, 'AGENT' | 'BANCA'>;
  roleCode: string;
}

/** BO-03: user administration. Every change is audited and ends affected sessions. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async list(query: UserQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      userType: query.userType,
      status: query.status,
      OR: search
        ? [
            { username: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SUMMARY,
        orderBy: { username: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.user.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async get(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SUMMARY });
    if (!user) {
      throw notFound('User');
    }
    return user;
  }

  /** Creates a back-office user. Local accounts receive a one-time temporary password. */
  async createStaff(input: CreateStaffUserDto) {
    await this.assertRolesFor(this.prisma, 'BACKOFFICE', input.roleIds);
    const temporaryPassword =
      input.authSource === 'LOCAL' ? this.passwords.generateTemporary() : undefined;
    const passwordHash = temporaryPassword ? await this.passwords.hash(temporaryPassword) : null;

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username.toLowerCase(),
          fullName: input.fullName.trim(),
          email: input.email.toLowerCase(),
          mobile: input.mobile,
          userType: 'STAFF',
          authSource: input.authSource,
          passwordHash,
          mustChangePassword: input.authSource === 'LOCAL',
          roles: { create: input.roleIds.map((roleId) => ({ roleId })) },
        },
        select: USER_SUMMARY,
      });
      await this.audit.record(
        { action: 'USER_CREATED', entityType: 'User', entityId: created.id, after: created },
        tx,
      );
      return created;
    });
    return { user, temporaryPassword };
  }

  /** Called when an agent registration is approved (AP-07/08): creates the portal login. */
  async createPortalAccount(
    tx: Prisma.TransactionClient,
    account: NewPortalAccount,
  ): Promise<void> {
    const role = await tx.role.findUnique({ where: { code: account.roleCode } });
    if (!role || role.audience !== 'PORTAL') {
      throw new Error(`Portal role ${account.roleCode} is not configured`);
    }
    const temporaryPassword = this.passwords.generateTemporary();
    const user = await tx.user.create({
      data: {
        username: account.username.toLowerCase(),
        fullName: account.fullName,
        email: account.email.toLowerCase(),
        mobile: account.mobile,
        userType: account.userType,
        passwordHash: await this.passwords.hash(temporaryPassword),
        mustChangePassword: true,
        agentId: account.agentId,
        roles: { create: { roleId: role.id } },
      },
    });
    await this.notifications.emailExternal(tx, user.email, {
      eventType: 'PORTAL_ACCOUNT_CREATED',
      subject: 'Your IIFT Agent/Banca Portal account',
      body:
        `Dear ${user.fullName},\n\nYour registration has been approved. Sign in to the IIFT Agent/Banca Portal with ` +
        `username "${user.username}" and temporary password: ${temporaryPassword}\n\nYou will be asked to choose a new password at first sign-in.`,
      sensitive: true,
    });
    await this.audit.record(
      {
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        after: { username: user.username, userType: user.userType },
      },
      tx,
    );
  }

  async update(actor: SessionUser, id: string, input: UpdateUserDto) {
    const before = await this.get(id);
    if (input.roleIds && actor.id === id) {
      throw new BusinessRuleError('SELF_ROLE_CHANGE', 'You cannot change your own roles');
    }
    const audience: Audience = before.userType === 'STAFF' ? 'BACKOFFICE' : 'PORTAL';
    if (input.roleIds) {
      await this.assertRolesFor(this.prisma, audience, input.roleIds);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: input.roleIds.map((roleId) => ({ userId: id, roleId })),
        });
      }
      const saved = await tx.user.update({
        where: { id },
        data: {
          fullName: input.fullName?.trim(),
          email: input.email?.toLowerCase(),
          mobile: input.mobile,
        },
        select: USER_SUMMARY,
      });
      await this.audit.record(
        { action: 'USER_UPDATED', entityType: 'User', entityId: id, before, after: saved },
        tx,
      );
      return saved;
    });
    if (input.roleIds) {
      await this.sessions.revokeAllSessions(id);
    }
    return updated;
  }

  async setStatus(actor: SessionUser, id: string, status: 'ACTIVE' | 'DISABLED') {
    if (actor.id === id) {
      throw new BusinessRuleError(
        'SELF_STATUS_CHANGE',
        'You cannot change the status of your own account',
      );
    }
    const before = await this.get(id);
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        where: { id },
        data: { status, failedLoginCount: 0, lockedUntil: null },
        select: USER_SUMMARY,
      });
      await this.audit.record(
        {
          action: status === 'ACTIVE' ? 'USER_ACTIVATED' : 'USER_DISABLED',
          entityType: 'User',
          entityId: id,
          before: { status: before.status },
          after: { status },
        },
        tx,
      );
      return saved;
    });
    await this.sessions.revokeAllSessions(id);
    return updated;
  }

  async unlock(id: string) {
    const before = await this.get(id);
    if (before.status === 'DISABLED') {
      throw new BusinessRuleError('USER_DISABLED', 'Activate the account instead of unlocking it');
    }
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        where: { id },
        data: { status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
        select: USER_SUMMARY,
      });
      await this.audit.record({ action: 'USER_UNLOCKED', entityType: 'User', entityId: id }, tx);
      return saved;
    });
  }

  /** Issues a temporary password (shown once to the administrator) and ends all sessions. */
  async resetPassword(actor: SessionUser, id: string) {
    if (actor.id === id) {
      throw new BusinessRuleError('SELF_RESET', 'Use "Change password" for your own account');
    }
    const user = await this.get(id);
    if (user.authSource !== 'LOCAL') {
      throw new BusinessRuleError(
        'DIRECTORY_ACCOUNT',
        'Directory accounts are reset in the corporate directory',
      );
    }
    // A reset clears a lock-out but never re-activates an account that was disabled.
    if (user.status === 'DISABLED') {
      throw new BusinessRuleError(
        'USER_DISABLED',
        'Activate the account before resetting its password',
      );
    }
    const temporaryPassword = this.passwords.generateTemporary();
    const passwordHash = await this.passwords.hash(temporaryPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          passwordChangedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          status: 'ACTIVE',
        },
      });
      await this.audit.record(
        { action: 'USER_PASSWORD_RESET', entityType: 'User', entityId: id },
        tx,
      );
    });
    await this.sessions.revokeAllSessions(id);
    return { temporaryPassword };
  }

  private async assertRolesFor(db: Db, audience: Audience, roleIds: string[]): Promise<void> {
    if (roleIds.length === 0) {
      throw new BusinessRuleError('ROLE_REQUIRED', 'Assign at least one role');
    }
    const roles = await db.role.findMany({
      where: { id: { in: roleIds } },
      select: { audience: true },
    });
    if (
      roles.length !== new Set(roleIds).size ||
      roles.some((role) => role.audience !== audience)
    ) {
      throw new BusinessRuleError(
        'INVALID_ROLE',
        `Only ${audience.toLowerCase()} roles can be assigned to this user`,
      );
    }
  }
}
