import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { register } from 'prom-client';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Public } from '../../common/security/decorators.js';

/** Liveness/readiness probes for the load balancer or orchestrator, and Prometheus metrics (NFR-26). */
@ApiExcludeController()
@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({ code: 'NOT_READY', message: 'Database unavailable' });
    }
  }

  @Get('metrics')
  @Header('Content-Type', register.contentType)
  async metrics(@Req() request: Request): Promise<string> {
    const expected = this.config.metricsToken;
    if (expected) {
      const provided = (request.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
      const a = Buffer.from(provided);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Metrics token required' });
      }
    }
    return register.metrics();
  }
}
