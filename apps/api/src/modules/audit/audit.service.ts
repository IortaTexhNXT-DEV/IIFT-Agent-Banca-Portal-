import { Injectable } from '@nestjs/common';
import { requestContext } from '../../common/context/request-context.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

/** Fields that must never be written to the audit trail in clear. */
const REDACTED_FIELDS = new Set([
  'passwordHash',
  'password',
  'newPassword',
  'currentPassword',
  'idNumberEnc',
  'idNumberHash',
  'tokenHash',
  'storageKey',
]);

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
}

/**
 * Writes the append-only audit trail (BO-26/27, COM-03, AP-35). Actor, IP address and
 * correlation id are taken from the current request context. Pass the transaction
 * client when the audited change happens inside a transaction so that both commit
 * or roll back together.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    const context = requestContext.current();
    await db.auditLog.create({
      data: {
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: toAuditJson(entry.before),
        after: toAuditJson(entry.after),
        actorId: context?.user?.id ?? null,
        actorName: context?.user?.username ?? 'system',
        ipAddress: context?.ipAddress ?? null,
        userAgent: context?.userAgent?.slice(0, 300) ?? null,
        correlationId: context?.correlationId ?? null,
      },
    });
  }
}

function toAuditJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === undefined || value === null) {
    return Prisma.DbNull;
  }
  return JSON.parse(JSON.stringify(value, redact)) as Prisma.InputJsonValue;
}

function redact(key: string, value: unknown): unknown {
  if (REDACTED_FIELDS.has(key)) {
    return '[REDACTED]';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}
