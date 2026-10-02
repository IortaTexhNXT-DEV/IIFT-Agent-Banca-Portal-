import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import ExcelJS from 'exceljs';
import { AppConfig } from '../../config/app-config.js';
import { BusinessRuleError } from '../../common/http/errors.js';
import { pageArgs, type PageQueryDto, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { businessDayRange, businessToday, toIsoDate } from '../../common/util/dates.js';
import { sum } from '../../common/util/money.js';
import type { EodRun, Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { FinanceOperation, OutboxService } from '../integration/outbox.service.js';
import { ReconciliationService } from '../integration/reconciliation.service.js';
import { csvCell } from '../reports/report-exporter.js';

const BRAND_MAGENTA = 'FFE1058C';

type IssuedPolicy = Prisma.PolicyGetPayload<{
  include: { product: true; participant: true; agency: true };
}>;
type DayReceipt = Prisma.ReceiptGetPayload<{
  include: { payment: true; policy: { include: { product: true; participant: true } } };
}>;

/**
 * End-of-day processing (Appendix 3, FFR01-08 / FFR02-07 / FFR03-08 / FFR04-07 /
 * FFR05-08): produces the EOD issuance report, the FIN interface file, posts the day's
 * totals to the financial system and reconciles receipts (tally with BRR).
 */
@Injectable()
export class EodService implements OnModuleInit {
  private readonly logger = new Logger(EodService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly scheduler: SchedulerRegistry,
    private readonly documents: DocumentsService,
    private readonly outbox: OutboxService,
    private readonly reconciliation: ReconciliationService,
    private readonly audit: AuditService,
  ) {}

  /** The EOD time is deployment configuration (EOD_CRON), so the job is registered at start-up. */
  onModuleInit(): void {
    if (!this.config.jobs.enabled) {
      return;
    }
    const job = CronJob.from({
      cronTime: this.config.jobs.eodCron,
      timeZone: this.config.jobs.timezone,
      onTick: () => {
        void this.prisma
          .withJobLock('end-of-day', async () => {
            await this.run(businessToday(), 'Scheduler');
          })
          .catch((error: Error) => this.logger.error(`Scheduled EOD failed: ${error.message}`));
      },
    });
    this.scheduler.addCronJob('end-of-day', job);
    job.start();
  }

  async list(query: PageQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eodRun.findMany({ orderBy: { businessDate: 'desc' }, ...pageArgs(query) }),
      this.prisma.eodRun.count(),
    ]);
    return toPage(items, total, query);
  }

  async run(businessDate: Date, triggeredBy: string): Promise<EodRun> {
    if (businessDate > businessToday()) {
      throw new BusinessRuleError('FUTURE_DATE', 'End-of-day cannot run for a future date');
    }
    const existing = await this.prisma.eodRun.findUnique({ where: { businessDate } });
    if (existing?.status === 'RUNNING' && existing.startedAt > new Date(Date.now() - 30 * 60_000)) {
      throw new BusinessRuleError('EOD_RUNNING', 'End-of-day is already running for this date');
    }
    const eod = await this.prisma.eodRun.upsert({
      where: { businessDate },
      create: { businessDate, status: 'RUNNING', triggeredBy },
      update: {
        status: 'RUNNING',
        startedAt: new Date(),
        finishedAt: null,
        errorMessage: null,
        triggeredBy,
      },
    });

    try {
      const completed = await this.process(eod, businessDate);
      await this.reconciliation.reconcileReceipts(businessDate);
      return completed;
    } catch (error) {
      this.logger.error(`EOD ${toIsoDate(businessDate)} failed: ${(error as Error).message}`);
      return this.prisma.eodRun.update({
        where: { id: eod.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          errorMessage: (error as Error).message.slice(0, 1000),
        },
      });
    }
  }

  private async process(eod: EodRun, businessDate: Date): Promise<EodRun> {
    const { from, to } = businessDayRange(businessDate);
    const [policies, receipts] = await Promise.all([
      this.prisma.policy.findMany({
        where: { issuedAt: { gte: from, lt: to } },
        include: { product: true, participant: true, agency: true },
        orderBy: { issuedAt: 'asc' },
      }),
      this.prisma.receipt.findMany({
        where: { issuedAt: { gte: from, lt: to } },
        include: { payment: true, policy: { include: { product: true, participant: true } } },
        orderBy: { issuedAt: 'asc' },
      }),
    ]);
    const isoDate = toIsoDate(businessDate);
    const totalContribution = sum(policies.map((p) => p.contribution));
    const totalReceipts = sum(receipts.map((r) => r.amount));

    return this.prisma.$transaction(async (tx) => {
      const report = await this.documents.storeGenerated(tx, {
        ownerType: 'REPORT',
        ownerId: eod.id,
        docType: 'EOD_REPORT',
        fileName: `eod-report-${isoDate}.xlsx`,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        content: await this.workbook(isoDate, policies, receipts),
      });
      const finFile = await this.documents.storeGenerated(tx, {
        ownerType: 'REPORT',
        ownerId: eod.id,
        docType: 'FIN_FILE',
        fileName: `fin-interface-${isoDate}.csv`,
        mimeType: 'text/csv',
        content: this.finInterface(isoDate, policies, receipts),
      });
      // A re-run for the same date is a new revision that replaces the earlier posting in
      // FIN; the deterministic key lets FIN ignore a revision it has already received.
      const revision =
        (await tx.outboxMessage.count({
          where: { operation: FinanceOperation.EodPosting, aggregateId: eod.id },
        })) + 1;
      await this.outbox.enqueue(
        tx,
        'FINANCE',
        FinanceOperation.EodPosting,
        {
          idempotencyKey: `EOD-${isoDate}-R${revision}`,
          businessDate: isoDate,
          revision,
          replacesPreviousRevision: revision > 1,
          policiesIssued: policies.length,
          totalContribution: totalContribution.toFixed(2),
          receiptsIssued: receipts.length,
          totalReceipts: totalReceipts.toFixed(2),
          receipts: receipts.map((r) => ({
            receiptNo: r.receiptNo,
            policyNo: r.policy.policyNo,
            amount: r.amount.toFixed(2),
          })),
        },
        { type: 'EodRun', id: eod.id },
      );
      const completed = await tx.eodRun.update({
        where: { id: eod.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          policiesIssued: policies.length,
          receiptsIssued: receipts.length,
          totalContribution,
          totalReceipts,
          reportDocumentId: report.id,
          finFileDocumentId: finFile.id,
        },
      });
      await this.audit.record(
        {
          action: 'EOD_COMPLETED',
          entityType: 'EodRun',
          entityId: eod.id,
          after: { businessDate: isoDate, policies: policies.length, receipts: receipts.length },
        },
        tx,
      );
      return completed;
    });
  }

  private async workbook(
    isoDate: string,
    policies: IssuedPolicy[],
    receipts: DayReceipt[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const addSheet = (
      name: string,
      headers: string[],
      rows: (string | number | Date | null)[][],
      moneyColumns: number[],
    ) => {
      const sheet = workbook.addWorksheet(name);
      sheet.addRow([`End-of-day ${name.toLowerCase()} – ${isoDate}`]).font = {
        bold: true,
        size: 13,
      };
      const header = sheet.addRow(headers);
      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_MAGENTA } };
      });
      rows.forEach((row) => sheet.addRow(row));
      headers.forEach((_, index) => {
        sheet.getColumn(index + 1).width = 20;
      });
      moneyColumns.forEach((index) => {
        sheet.getColumn(index).numFmt = '#,##0.00';
      });
    };

    const products = [...new Set(policies.map((p) => p.product.name))];
    addSheet(
      'Summary',
      ['Product', 'Policies issued', 'Contribution (B$)'],
      [
        ...products.map((name) => {
          const items = policies.filter((p) => p.product.name === name);
          return [name, items.length, sum(items.map((p) => p.contribution)).toNumber()];
        }),
        ['Total', policies.length, sum(policies.map((p) => p.contribution)).toNumber()],
        ['Receipts issued', receipts.length, sum(receipts.map((r) => r.amount)).toNumber()],
      ],
      [3],
    );
    addSheet(
      'Policies issued',
      [
        'Policy no.',
        'Product',
        'Participant',
        'Agency / bank',
        'Sum covered (B$)',
        'Contribution (B$)',
        'Payment status',
      ],
      policies.map((p) => [
        p.policyNo,
        p.product.name,
        p.participant.fullName,
        p.agency.name,
        p.sumCovered.toNumber(),
        p.contribution.toNumber(),
        p.paymentStatus,
      ]),
      [5, 6],
    );
    addSheet(
      'Receipts',
      [
        'Receipt no.',
        'Policy / quotation',
        'Participant',
        'Payment batch',
        'Method',
        'Bank reference',
        'Amount (B$)',
      ],
      receipts.map((r) => [
        r.receiptNo,
        r.policy.policyNo ?? r.policy.quotationNo,
        r.policy.participant.fullName,
        r.payment.paymentNo,
        r.payment.method,
        r.payment.referenceNo,
        r.amount.toNumber(),
      ]),
      [7],
    );
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * FIN interface file: one line per issued policy (PI) and per receipt (RC). The
   * column layout is agreed with Finance during the interface specification (DEL-09).
   */
  private finInterface(isoDate: string, policies: IssuedPolicy[], receipts: DayReceipt[]): Buffer {
    const header = [
      'record_type',
      'business_date',
      'reference',
      'policy_no',
      'product_code',
      'counterparty',
      'amount',
      'currency',
    ];
    const lines = [header.map(csvCell).join(',')];
    for (const p of policies) {
      lines.push(
        [
          'PI',
          isoDate,
          p.quotationNo,
          p.policyNo ?? '',
          p.product.code,
          p.agency.code,
          p.contribution.toFixed(2),
          'BND',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    for (const r of receipts) {
      lines.push(
        [
          'RC',
          isoDate,
          r.receiptNo,
          r.policy.policyNo ?? r.policy.quotationNo,
          r.policy.product.code,
          r.payment.referenceNo,
          r.amount.toFixed(2),
          'BND',
        ]
          .map(csvCell)
          .join(','),
      );
    }
    return Buffer.from(`${lines.join('\r\n')}\r\n`, 'utf8');
  }
}
