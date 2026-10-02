import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

const HEADER = 'x-request-id';
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Assigns every request a correlation id (reusing a well-formed id from the reverse
 * proxy when present) and echoes it in the response so users can quote it to support.
 */
export function correlationId(request: Request, response: Response, next: NextFunction): void {
  const incoming = request.header(HEADER);
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  request.id = id;
  response.setHeader(HEADER, id);
  next();
}
