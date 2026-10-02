import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  ALLOW_PASSWORD_CHANGE_PENDING,
  PUBLIC_ROUTE,
  REQUIRED_AUDIENCE,
} from '../../../common/security/decorators.js';
import type { AudienceCode } from '../../../common/security/session-user.js';
import { Setting } from '../../settings/setting-keys.js';
import { SettingsService } from '../../settings/settings.service.js';
import { SessionService } from '../session.service.js';

/**
 * Global guard: every route needs an authenticated, non-expired session unless it is
 * marked @Public(). Also enforces the portal/back-office split and the forced
 * password change after first login or password expiry.
 */
@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly settings: SettingsService,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.session?.user;
    if (!user || !request.session.authenticatedAt) {
      throw new UnauthorizedException({ code: 'NOT_AUTHENTICATED', message: 'Please sign in' });
    }

    const absoluteLimitMs = (await this.settings.getInt(Setting.SessionAbsoluteHours)) * 3_600_000;
    if (Date.now() - request.session.authenticatedAt > absoluteLimitMs) {
      await this.sessions.destroy(request);
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      });
    }
    // Rolling idle timeout: each authenticated request extends the cookie lifetime.
    request.session.cookie.maxAge =
      (await this.settings.getInt(Setting.SessionIdleMinutes)) * 60_000;

    const audience = this.reflector.getAllAndOverride<AudienceCode | undefined>(
      REQUIRED_AUDIENCE,
      targets,
    );
    if (audience && user.audience !== audience) {
      throw new ForbiddenException({
        code: 'WRONG_AUDIENCE',
        message: 'This function is not available to your account type',
      });
    }

    const allowedWhilePending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PASSWORD_CHANGE_PENDING,
      targets,
    );
    if (user.mustChangePassword && !allowedWhilePending) {
      throw new ForbiddenException({
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before continuing',
      });
    }
    return true;
  }
}
