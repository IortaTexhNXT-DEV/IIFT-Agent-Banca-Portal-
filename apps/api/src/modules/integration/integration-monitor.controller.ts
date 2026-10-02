import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsISO8601, IsOptional } from 'class-validator';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PageQueryDto, pageArgs, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import { parseIsoDate } from '../../common/util/dates.js';
import { IntegrationSystem, OutboxStatus } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { ReconciliationService } from './reconciliation.service.js';

const SYSTEMS = Object.values(IntegrationSystem);
const OUTBOX_STATUSES = Object.values(OutboxStatus);

class OutboxQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SYSTEMS }) @IsOptional() @IsIn(SYSTEMS) system?: IntegrationSystem;
  @ApiPropertyOptional({ enum: OUTBOX_STATUSES })
  @IsOptional()
  @IsIn(OUTBOX_STATUSES)
  status?: OutboxStatus;
}

class LogQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: SYSTEMS }) @IsOptional() @IsIn(SYSTEMS) system?: IntegrationSystem;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : value === 'true' || value === true))
  @IsBoolean()
  success?: boolean;
}

class ReconcileDto {
  @ApiProperty({ example: '2026-10-01' }) @IsISO8601({ strict: true }) businessDate: string;
}

/** INT-11/13/14/15: integration health, message queue, retry and reconciliation. */
@ApiTags('Back-office: Integration')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoIntegrationManage)
@Controller('backoffice/integration')
export class IntegrationMonitorController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: ReconciliationService,
    private readonly audit: AuditService,
  ) {}

  /** Per-system availability and performance over the last 24 hours. */
  @Get('summary')
  async summary() {
    const since = new Date(Date.now() - 86_400_000);
    const [logStats, queue] = await this.prisma.$transaction([
      this.prisma.integrationLog.groupBy({
        by: ['system', 'success'],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _avg: { durationMs: true },
        orderBy: { system: 'asc' },
      }),
      this.prisma.outboxMessage.groupBy({
        by: ['system', 'status'],
        where: { status: { in: ['PENDING', 'FAILED', 'DEAD'] } },
        _count: { _all: true },
        orderBy: { system: 'asc' },
      }),
    ]);
    return SYSTEMS.map((system) => {
      const ok = logStats.find((s) => s.system === system && s.success);
      const failed = logStats.find((s) => s.system === system && !s.success);
      const queued = (status: OutboxStatus) =>
        queue.find((q) => q.system === system && q.status === status)?._count._all ?? 0;
      const okCount = ok?._count._all ?? 0;
      const failedCount = failed?._count._all ?? 0;
      return {
        system,
        successCount: okCount,
        failureCount: failedCount,
        successRate:
          okCount + failedCount === 0
            ? null
            : Math.round((okCount / (okCount + failedCount)) * 1000) / 10,
        averageMs: ok?._avg.durationMs ? Math.round(ok._avg.durationMs) : null,
        pending: queued('PENDING'),
        retrying: queued('FAILED'),
        deadLetter: queued('DEAD'),
      };
    });
  }

  @Get('outbox')
  async outbox(@Query() query: OutboxQueryDto) {
    const where = { system: query.system, status: query.status };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.outboxMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.outboxMessage.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  /** Re-queues a failed or dead-lettered message for immediate delivery. */
  @Post('outbox/:id/retry')
  @HttpCode(200)
  async retry(@Param('id', ParseUUIDPipe) id: string) {
    const message = await this.prisma.outboxMessage.findUnique({ where: { id } });
    if (!message) {
      throw notFound('Integration message');
    }
    if (message.status === 'SENT') {
      throw new BusinessRuleError('ALREADY_SENT', 'This message has already been delivered');
    }
    const updated = await this.prisma.outboxMessage.update({
      where: { id },
      data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lastError: null },
    });
    await this.audit.record({
      action: 'INTEGRATION_RETRY',
      entityType: 'OutboxMessage',
      entityId: id,
      before: { status: message.status },
    });
    return updated;
  }

  @Get('logs')
  async logs(@Query() query: LogQueryDto) {
    const where = { system: query.system, success: query.success };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.integrationLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.integrationLog.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  @Get('reconciliations')
  async reconciliations(@Query() query: PageQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.reconciliationRun.findMany({
        orderBy: { createdAt: 'desc' },
        ...pageArgs(query),
      }),
      this.prisma.reconciliationRun.count(),
    ]);
    return toPage(items, total, query);
  }

  @Post('reconciliations')
  reconcile(@Body() body: ReconcileDto) {
    return this.reconciliation.reconcileReceipts(parseIsoDate(body.businessDate));
  }
}
