import {
  ConflictException,
  HttpStatus,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/**
 * A request that is well-formed but breaks a business rule (e.g. agency is blocked
 * from issuing, quotation not in DRAFT). Returned as HTTP 422 with a stable code the
 * front end can react to.
 */
export class BusinessRuleError extends UnprocessableEntityException {
  constructor(code: string, message: string, details?: string[]) {
    super({ statusCode: HttpStatus.UNPROCESSABLE_ENTITY, code, message, details });
  }
}

export function notFound(entity: string): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    code: 'NOT_FOUND',
    message: `${entity} not found`,
  });
}

/** Raised when an optimistic-lock check fails because someone else changed the record. */
export function staleRecord(entity: string): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    code: 'STALE_RECORD',
    message: `${entity} was changed by another user. Refresh and try again.`,
  });
}
