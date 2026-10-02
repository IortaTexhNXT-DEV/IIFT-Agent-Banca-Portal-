import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { PermissionCode } from './permissions.js';
import type { AudienceCode, SessionUser } from './session-user.js';

export const PUBLIC_ROUTE = 'security:public';
export const REQUIRED_AUDIENCE = 'security:audience';
export const REQUIRED_PERMISSIONS = 'security:permissions';
export const ALLOW_PASSWORD_CHANGE_PENDING = 'security:allowPasswordChangePending';

/** Route is reachable without a session (login, health, public e-signature page). */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

/** Restricts a controller to portal users or back-office users. */
export const ForAudience = (audience: AudienceCode) => SetMetadata(REQUIRED_AUDIENCE, audience);

/** The user needs every listed permission. */
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS, permissions);

/** Route stays usable while the user is forced to change an expired/temporary password. */
export const AllowWhilePasswordChangePending = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_PENDING, true);

/** Injects the signed-in user. Only use on routes protected by the authentication guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUser => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.session?.user;
    if (!user) {
      throw new Error('CurrentUser used on a route without an authenticated session');
    }
    return user;
  },
);
