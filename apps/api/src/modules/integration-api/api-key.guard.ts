import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../config/app-config.js';

/**
 * System-to-system authentication for inbound integration APIs (INT-09/10). The caller
 * presents an API key; only its SHA-256 hash is held in configuration. Network-level
 * restriction (IP allow-list / mutual TLS at the gateway) is applied in addition.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: AppConfig) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedHash = this.config.integration.inboundApiKeyHash;
    if (!expectedHash) {
      throw new ServiceUnavailableException({
        code: 'NOT_CONFIGURED',
        message: 'Inbound integration is not configured',
      });
    }
    const key = context.switchToHttp().getRequest<Request>().header('x-api-key') ?? '';
    const actual = createHash('sha256').update(key).digest();
    const expected = Buffer.from(expectedHash, 'hex');
    if (
      key.length === 0 ||
      expected.length !== actual.length ||
      !timingSafeEqual(actual, expected)
    ) {
      throw new UnauthorizedException({ code: 'INVALID_API_KEY', message: 'Invalid API key' });
    }
    return true;
  }
}
