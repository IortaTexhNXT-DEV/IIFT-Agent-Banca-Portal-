import { Injectable } from '@nestjs/common';
import { notFound } from '../../common/http/errors.js';
import { pageArgs, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { AgencyQueryDto, CreateAgencyDto, UpdateAgencyDto } from './agency.dto.js';

/** BO-09 / AP-10: agencies (agency channel) and partner banks (banca channel). */
@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: AgencyQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.AgencyWhereInput = {
      channel: query.channel,
      status: query.status,
      OR: search
        ? [
            { code: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.agency.findMany({
        where,
        orderBy: { name: 'asc' },
        include: { _count: { select: { agents: { where: { status: 'ACTIVE' } } } } },
        ...pageArgs(query),
      }),
      this.prisma.agency.count({ where }),
    ]);
    return toPage(
      items.map(({ _count, ...agency }) => ({ ...agency, activeAgents: _count.agents })),
      total,
      query,
    );
  }

  async options() {
    return this.prisma.agency.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, code: true, name: true, channel: true },
      orderBy: { name: 'asc' },
    });
  }

  async get(id: string) {
    const agency = await this.prisma.agency.findUnique({ where: { id } });
    if (!agency) {
      throw notFound('Agency');
    }
    const [agentsByStatus, outstanding] = await this.prisma.$transaction([
      this.prisma.agent.groupBy({
        by: ['status'],
        where: { agencyId: id },
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
      this.prisma.policy.aggregate({
        where: { agencyId: id, status: 'ACTIVE', paymentStatus: { not: 'PAID' } },
        _sum: { outstandingAmount: true },
        _count: { _all: true },
      }),
    ]);
    return {
      ...agency,
      agentsByStatus: Object.fromEntries(
        agentsByStatus.map((row) => [row.status, row._count._all]),
      ),
      outstandingPolicies: outstanding._count._all,
      outstandingAmount: outstanding._sum.outstandingAmount ?? 0,
    };
  }

  async create(input: CreateAgencyDto) {
    return this.prisma.$transaction(async (tx) => {
      const agency = await tx.agency.create({
        data: { ...input, code: input.code.toUpperCase(), email: input.email?.toLowerCase() },
      });
      await this.audit.record(
        { action: 'AGENCY_CREATED', entityType: 'Agency', entityId: agency.id, after: agency },
        tx,
      );
      return agency;
    });
  }

  async update(id: string, input: UpdateAgencyDto) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.agency.findUnique({ where: { id } });
      if (!before) {
        throw notFound('Agency');
      }
      const agency = await tx.agency.update({
        where: { id },
        data: { ...input, email: input.email?.toLowerCase() },
      });
      await this.audit.record(
        { action: 'AGENCY_UPDATED', entityType: 'Agency', entityId: id, before, after: agency },
        tx,
      );
      return agency;
    });
  }

  /**
   * Temporary manual override of the automatic payment block (AP-42), e.g. when payment
   * was made outside the portal. The daily check re-applies the block if contributions
   * are still overdue.
   */
  async liftIssuanceBlock(id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.agency.findUnique({ where: { id } });
      if (!before) {
        throw notFound('Agency');
      }
      const agency = await tx.agency.update({
        where: { id },
        data: { issuanceBlocked: false, issuanceBlockedAt: null, issuanceBlockReason: null },
      });
      await this.audit.record(
        {
          action: 'AGENCY_BLOCK_LIFTED',
          entityType: 'Agency',
          entityId: id,
          before: { issuanceBlocked: before.issuanceBlocked, reason: before.issuanceBlockReason },
          after: { reason },
        },
        tx,
      );
      return agency;
    });
  }
}
