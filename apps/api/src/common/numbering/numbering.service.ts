import { Injectable } from '@nestjs/common';
import type { Db } from '../prisma/prisma.service.js';

/**
 * Business reference numbers. Each kind is backed by a PostgreSQL sequence
 * (created in the initial migration), which is gap-tolerant and safe under
 * concurrency across multiple API replicas.
 */
const SEQUENCES = {
  agent: 'seq_agent_code',
  participant: 'seq_participant_no',
  quotation: 'seq_quotation_no',
  policy: 'seq_policy_no',
  payment: 'seq_payment_no',
  receipt: 'seq_receipt_no',
  claim: 'seq_claim_no',
  issue: 'seq_issue_no',
  request: 'seq_request_no',
} as const;

export type ReferenceKind = keyof typeof SEQUENCES;

const YEARLY_PREFIX: Record<Exclude<ReferenceKind, 'agent' | 'policy'>, string> = {
  participant: 'PT',
  quotation: 'QT',
  payment: 'PY',
  receipt: 'RC',
  claim: 'CL',
  issue: 'IS',
  request: 'RQ',
};

@Injectable()
export class NumberingService {
  /** e.g. QT/26/000123 */
  async next(db: Db, kind: Exclude<ReferenceKind, 'agent' | 'policy'>): Promise<string> {
    const value = await this.nextValue(db, kind);
    return `${YEARLY_PREFIX[kind]}/${yearSuffix()}/${pad(value)}`;
  }

  /** e.g. AG-000045 for agency agents, BK-000012 for bank officers. */
  async nextAgentCode(db: Db, prefix: 'AG' | 'BK'): Promise<string> {
    const value = await this.nextValue(db, 'agent');
    return `${prefix}-${pad(value)}`;
  }

  /** e.g. PRO/26/000045 — the product code makes the policy line recognisable. */
  async nextPolicyNo(db: Db, productCode: string): Promise<string> {
    const value = await this.nextValue(db, 'policy');
    return `${productCode}/${yearSuffix()}/${pad(value)}`;
  }

  private async nextValue(db: Db, kind: ReferenceKind): Promise<bigint> {
    const sequence = SEQUENCES[kind];
    const [row] = await db.$queryRaw<{ value: bigint }[]>`
      SELECT nextval(${sequence}::regclass) AS value`;
    return row.value;
  }
}

function pad(value: bigint): string {
  return value.toString().padStart(6, '0');
}

function yearSuffix(): string {
  return String(new Date().getFullYear()).slice(-2);
}
