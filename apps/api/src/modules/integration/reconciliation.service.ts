import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { businessDayRange, toIsoDate } from '../../common/util/dates.js';
import { money, sum } from '../../common/util/money.js';
import type { ReconciliationRun } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { FinanceGateway } from './gateways.js';
import { FinanceOperation } from './outbox.service.js';

/**
 * INT-15 / Appendix 3 "tally with BRR": compares receipts issued by the portal on a
 * business date with what the financial system reports as posted.
 */
@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly finance: FinanceGateway,
    private readonly audit: AuditService,
  ) {}

  async reconcileReceipts(businessDate: Date): Promise<ReconciliationRun> {
    const { from, to } = businessDayRange(businessDate);
    const receipts = await this.prisma.receipt.findMany({
      where: { issuedAt: { gte: from, lt: to } },
      select: { receiptNo: true, amount: true },
    });
    const posted = await this.postedReferences(businessDate, from, to);

    const matched = receipts.filter((receipt) => posted.has(receipt.receiptNo));
    const unmatched = receipts
      .filter((receipt) => !posted.has(receipt.receiptNo))
      .map((receipt) => receipt.receiptNo);
    const expectedAmount = sum(receipts.map((r) => r.amount));
    const matchedAmount = sum(matched.map((r) => r.amount));
    const status = unmatched.length === 0 ? 'MATCHED' : 'MISMATCH';

    const run = await this.prisma.reconciliationRun.create({
      data: {
        businessDate,
        system: 'FINANCE',
        expectedCount: receipts.length,
        matchedCount: matched.length,
        expectedAmount,
        matchedAmount: money(matchedAmount),
        status,
        details: { unmatchedReceipts: unmatched },
      },
    });
    await this.audit.record({
      action: 'RECONCILIATION_RUN',
      entityType: 'ReconciliationRun',
      entityId: run.id,
      after: { businessDate: toIsoDate(businessDate), status },
    });
    return run;
  }

  /**
   * Receipt numbers known to the financial system. In simulated mode (before FIN
   * connectivity is available) the receipts successfully delivered from the outbox
   * are used instead.
   */
  private async postedReferences(businessDate: Date, from: Date, to: Date): Promise<Set<string>> {
    if (!this.finance.isSimulated) {
      const totals = await this.finance.postedReceipts(toIsoDate(businessDate));
      return new Set(totals.references);
    }
    const delivered = await this.prisma.outboxMessage.findMany({
      where: {
        system: 'FINANCE',
        operation: FinanceOperation.ReceiptPosted,
        status: 'SENT',
        createdAt: { gte: from, lt: to },
      },
      select: { payload: true },
    });
    return new Set(
      delivered.map((message) => (message.payload as { receiptNo?: string }).receiptNo ?? ''),
    );
  }
}
