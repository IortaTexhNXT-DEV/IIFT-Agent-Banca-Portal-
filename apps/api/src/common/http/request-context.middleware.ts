import type { NextFunction, Request, Response } from 'express';
import { requestContext } from '../context/request-context.js';

/** Binds correlation id, user and client details to the async context of the request. */
export function requestContextMiddleware(
  request: Request,
  _response: Response,
  next: NextFunction,
): void {
  requestContext.run(
    {
      correlationId: String(request.id),
      user: request.session?.user,
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
    },
    next,
  );
}
