import { Controller, Get, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';
import { PageQueryDto, pageArgs, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { Prisma } from '../../generated/prisma/client.js';

export class AuditQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() to?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) actor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) entityId?: string;
}

/** BO-28: authorised users search and retrieve audit records. */
@ApiTags('Back-office: Audit')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoAuditView)
@Controller('backoffice/audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@Query() query: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      occurredAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
      actorName: query.actor ? { contains: query.actor, mode: 'insensitive' } : undefined,
      action: query.action || undefined,
      entityType: query.entityType || undefined,
      entityId: query.entityId || undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({ where, orderBy: { occurredAt: 'desc' }, ...pageArgs(query) }),
      this.prisma.auditLog.count({ where }),
    ]);
    return toPage(
      items.map((item) => ({ ...item, id: item.id.toString() })),
      total,
      query,
    );
  }

  @Get('facets')
  async facets() {
    const [actions, entityTypes] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
    ]);
    return {
      actions: actions.map((a) => a.action),
      entityTypes: entityTypes.map((e) => e.entityType),
    };
  }
}
