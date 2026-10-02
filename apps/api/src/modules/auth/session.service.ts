import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SessionUser } from '../../common/security/session-user.js';

/** Wraps express-session operations and server-side session revocation. */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  /**
   * Starts an authenticated session. The session id is regenerated to prevent
   * session fixation, and a fresh CSRF token is issued.
   */
  async establish(request: Request, user: SessionUser): Promise<string> {
    await new Promise<void>((resolve, reject) =>
      request.session.regenerate((error) => (error ? reject(error) : resolve())),
    );
    const csrfToken = randomBytes(32).toString('base64url');
    request.session.user = user;
    request.session.csrfToken = csrfToken;
    request.session.authenticatedAt = Date.now();
    await this.save(request);
    return csrfToken;
  }

  async refreshUser(request: Request, user: SessionUser): Promise<void> {
    request.session.user = user;
    await this.save(request);
  }

  async destroy(request: Request, response?: Response): Promise<void> {
    if (request.session) {
      await new Promise<void>((resolve, reject) =>
        request.session.destroy((error) => (error ? reject(error) : resolve())),
      );
    }
    response?.clearCookie(this.config.session.cookieName, { path: '/' });
  }

  /** Ends every other session of the user (single active session, password change). */
  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM user_session
      WHERE (sess::jsonb -> 'user' ->> 'id') = ${userId} AND sid <> ${currentSessionId}`;
  }

  /** Ends all sessions of the user (deactivation, role change, administrator unlock/reset). */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM user_session WHERE (sess::jsonb -> 'user' ->> 'id') = ${userId}`;
  }

  private save(request: Request): Promise<void> {
    return new Promise((resolve, reject) =>
      request.session.save((error) => (error ? reject(error) : resolve())),
    );
  }
}
