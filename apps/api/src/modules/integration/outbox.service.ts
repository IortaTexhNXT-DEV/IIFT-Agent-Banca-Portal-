import { Injectable } from '@nestjs/common';
import { requestContext } from '../../common/context/request-context.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { IntegrationSystem } from '../../generated/prisma/enums.js';

/** Operations sent to IITH systems. Names are part of the interface specification (DEL-09). */
export const CoreOperation = {
  AgentUpsert: 'AGENT_UPSERT',
  ParticipantUpsert: 'PARTICIPANT_UPSERT',
  PolicyIssued: 'POLICY_ISSUED',
  PolicyEndorsed: 'POLICY_ENDORSED',
  PolicyCancelled: 'POLICY_CANCELLED',
  ClaimNotified: 'CLAIM_NOTIFIED',
} as const;

export const FinanceOperation = {
  ReceiptPosted: 'RECEIPT_POSTED',
  RefundRequested: 'REFUND_REQUESTED',
  CommissionAccrued: 'COMMISSION_ACCRUED',
  EodPosting: 'EOD_POSTING',
} as const;

export interface OutboxAggregate {
  type: string;
  id: string;
}

/**
 * Transactional outbox: integration messages are written in the same database
 * transaction as the business change, so a message is never lost and never sent for
 * a change that rolled back. OutboxDispatcher delivers them asynchronously with retry.
 */
@Injectable()
export class OutboxService {
  async enqueue(
    db: Db,
    system: Extract<IntegrationSystem, 'CORE' | 'FINANCE'>,
    operation: string,
    payload: Prisma.InputJsonValue,
    aggregate?: OutboxAggregate,
  ): Promise<void> {
    await db.outboxMessage.create({
      data: {
        system,
        operation,
        payload,
        aggregateType: aggregate?.type,
        aggregateId: aggregate?.id,
        correlationId: requestContext.current()?.correlationId,
      },
    });
  }
}
