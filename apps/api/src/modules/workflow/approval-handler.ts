import type { ApprovalRequest, Prisma } from '../../generated/prisma/client.js';
import type { ApprovalType } from '../../generated/prisma/enums.js';

/**
 * Applies the business effect of a decided approval request. Each feature module
 * registers one handler per request type it raises (e.g. the agents module handles
 * AGENT_REGISTRATION). Handlers run inside the transaction that records the decision.
 */
export interface ApprovalHandler {
  readonly type: ApprovalType;
  onApproved(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void>;
  onRejected(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void>;
  onWithdrawn?(request: ApprovalRequest, tx: Prisma.TransactionClient): Promise<void>;
}

/** Link to the record under approval, used in notifications. */
export function backofficeLink(request: Pick<ApprovalRequest, 'id'>): string {
  return `/backoffice/approvals/${request.id}`;
}
