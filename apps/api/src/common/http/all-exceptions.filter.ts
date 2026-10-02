import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';

interface ErrorBody {
  statusCode: number;
  code: string;
  message: string;
  details?: string[];
  correlationId: string;
}

/**
 * Converts every error into a consistent JSON body. Unexpected errors are logged with
 * full detail but the client only receives a generic message and a correlation id
 * (NFR-15: no technical details exposed to users).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ErrorHandler');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const correlationId = String(request.id ?? '');
    const body = this.toBody(exception, correlationId);

    if (body.statusCode >= 500) {
      this.logger.error({ err: exception, correlationId, path: request.path }, 'Unhandled error');
    }
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown, correlationId: string): ErrorBody {
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: 429,
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many requests. Please wait and try again.',
        correlationId,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const data = payload as { code?: string; message?: string | string[]; details?: string[] };
        const messages = Array.isArray(data.message) ? data.message : undefined;
        return {
          statusCode: status,
          code: data.code ?? defaultCode(status),
          message: messages
            ? 'Some fields are invalid'
            : typeof data.message === 'string'
              ? data.message
              : exception.message,
          details: messages ?? data.details,
          correlationId,
        };
      }
      return {
        statusCode: status,
        code: defaultCode(status),
        message: String(payload),
        correlationId,
      };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          statusCode: 409,
          code: 'DUPLICATE',
          message: 'A record with the same unique value already exists',
          correlationId,
        };
      }
      if (exception.code === 'P2025') {
        return {
          statusCode: 409,
          code: 'STALE_RECORD',
          message: 'The record was changed or removed by another user. Refresh and try again.',
          correlationId,
        };
      }
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please contact support quoting the reference number.',
      correlationId,
    };
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'NOT_AUTHENTICATED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}
