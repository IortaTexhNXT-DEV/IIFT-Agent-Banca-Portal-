import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { requestContext } from '../../common/context/request-context.js';
import { BusinessRuleError } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import type { User } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import { DirectoryAuthenticator } from './directory-authenticator.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { SessionUserFactory } from './session-user.factory.js';

export interface LoginResult {
  user: SessionUser;
  csrfToken: string;
}

const INVALID_CREDENTIALS = 'Invalid username or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly sessionUsers: SessionUserFactory,
    private readonly settings: SettingsService,
    private readonly directory: DirectoryAuthenticator,
    private readonly audit: AuditService,
  ) {}

  /** AP-01/03/04, BO-01: authenticate, apply lockout rules and start a fresh session. */
  async login(request: Request, username: string, password: string): Promise<LoginResult> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
      include: { agent: { include: { agency: true } } },
    });

    if (!user) {
      await this.passwords.verifyAgainstDummy(password);
      await this.audit.record({
        action: 'LOGIN_FAILED',
        entityType: 'User',
        after: { username, reason: 'UNKNOWN_USER' },
      });
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: INVALID_CREDENTIALS,
      });
    }

    await this.assertNotLocked(user);

    const valid =
      user.authSource === 'DIRECTORY'
        ? await this.directory.verify(user.username, password)
        : user.passwordHash !== null && (await this.passwords.verify(user.passwordHash, password));
    if (!valid) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: INVALID_CREDENTIALS,
      });
    }

    if (user.status === 'DISABLED') {
      await this.audit.record({
        action: 'LOGIN_REJECTED',
        entityType: 'User',
        entityId: user.id,
        after: { reason: 'DISABLED' },
      });
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'Your account is not active. Please contact the administrator.',
      });
    }
    if (user.agent && (user.agent.status !== 'ACTIVE' || user.agent.agency.status !== 'ACTIVE')) {
      await this.audit.record({
        action: 'LOGIN_REJECTED',
        entityType: 'User',
        entityId: user.id,
        after: { reason: 'AGENT_NOT_ACTIVE' },
      });
      throw new UnauthorizedException({
        code: 'AGENT_NOT_ACTIVE',
        message: 'Your agent/banca registration is not active.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null, status: 'ACTIVE', lastLoginAt: new Date() },
    });

    const mustChangePassword =
      user.authSource === 'LOCAL' &&
      (user.mustChangePassword || (await this.passwords.isExpired(user.passwordChangedAt)));
    const sessionUser = await this.sessionUsers.build(user.id, mustChangePassword);
    const csrfToken = await this.sessions.establish(request, sessionUser);
    requestContext.setUser(sessionUser);

    if (await this.settings.getBool(Setting.SessionSingleActive)) {
      await this.sessions.revokeOtherSessions(user.id, request.sessionID);
    }
    await this.audit.record({ action: 'LOGIN', entityType: 'User', entityId: user.id });
    return { user: sessionUser, csrfToken };
  }

  async logout(request: Request): Promise<void> {
    const user = request.session?.user;
    if (user) {
      await this.audit.record({ action: 'LOGOUT', entityType: 'User', entityId: user.id });
    }
  }

  /** AP-02: change password subject to policy and history; other sessions are ended. */
  async changePassword(
    request: Request,
    currentPassword: string,
    newPassword: string,
  ): Promise<SessionUser> {
    const sessionUser = request.session.user!;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: sessionUser.id } });
    if (user.authSource !== 'LOCAL') {
      throw new BusinessRuleError(
        'DIRECTORY_ACCOUNT',
        'Directory accounts change their password through the corporate directory',
      );
    }
    if (!user.passwordHash || !(await this.passwords.verify(user.passwordHash, currentPassword))) {
      throw new BusinessRuleError('CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect');
    }
    if (currentPassword === newPassword) {
      throw new BusinessRuleError(
        'PASSWORD_UNCHANGED',
        'New password must be different from the current password',
      );
    }
    await this.passwords.assertMeetsPolicy(newPassword, user.username);
    await this.passwords.assertNotRecentlyUsed(this.prisma, user.id, newPassword);

    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
      });
      await tx.passwordHistory.create({ data: { userId: user.id, passwordHash } });
      await this.audit.record(
        { action: 'PASSWORD_CHANGED', entityType: 'User', entityId: user.id },
        tx,
      );
    });

    await this.sessions.revokeOtherSessions(user.id, request.sessionID);
    const refreshed = await this.sessionUsers.build(user.id, false);
    await this.sessions.refreshUser(request, refreshed);
    return refreshed;
  }

  private async assertNotLocked(user: User): Promise<void> {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.record({
        action: 'LOGIN_REJECTED',
        entityType: 'User',
        entityId: user.id,
        after: { reason: 'LOCKED' },
      });
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message:
          'Your account is temporarily locked after repeated failed sign-in attempts. Try again later or contact the administrator.',
      });
    }
  }

  private async registerFailedAttempt(user: User): Promise<void> {
    const maxAttempts = await this.settings.getInt(Setting.LockoutMaxAttempts);
    const attempts = user.failedLoginCount + 1;
    const lock = attempts >= maxAttempts;
    const lockMinutes = await this.settings.getInt(Setting.LockoutMinutes);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lock ? 0 : attempts,
        status: lock && user.status !== 'DISABLED' ? 'LOCKED' : user.status,
        lockedUntil: lock ? new Date(Date.now() + lockMinutes * 60_000) : user.lockedUntil,
      },
    });
    await this.audit.record({
      action: lock ? 'ACCOUNT_LOCKED' : 'LOGIN_FAILED',
      entityType: 'User',
      entityId: user.id,
      after: { attempts },
    });
  }
}
