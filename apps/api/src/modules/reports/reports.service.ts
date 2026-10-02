import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AppConfig } from '../../config/app-config.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService, UNRESTRICTED } from '../../common/security/data-scope.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import {
  addDays,
  BUSINESS_TIME_ZONE,
  businessToday,
  parseIsoDate,
  toIsoDate,
} from '../../common/util/dates.js';
import type { ReportSchedule } from '../../generated/prisma/client.js';
import type { ExportFormat, ReportFrequency } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { REPORTS } from './report-definitions.js';
import { type ExportedReport, ReportExporter } from './report-exporter.js';
import type { ReportDefinition, ReportFilters } from './report-types.js';

const PREVIEW_LIMIT = 500;
const EXPORT_LIMIT = 50_000;
const SCHEDULE_HOUR_UTC = 23; // 07:00 Brunei time

export interface ReportFilterInput {
  from?: string;
  to?: string;
  productId?: string;
  agencyId?: string;
  agentId?: string;
  status?: string;
}

/** Relative periods used by scheduled reports. */
export type SchedulePeriod =
  'PREVIOUS_DAY' | 'PREVIOUS_7_DAYS' | 'PREVIOUS_MONTH' | 'MONTH_TO_DATE';

export interface ScheduleInput {
  reportCode: string;
  name: string;
  frequency: ReportFrequency;
  format: ExportFormat;
  recipients: string[];
  period: SchedulePeriod;
}

/** Common reporting framework (COM-08) with on-demand and scheduled reports (BO-25). */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly scopes: DataScopeService,
    private readonly exporter: ReportExporter,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  catalogue(user: SessionUser) {
    return REPORTS.filter((report) => report.audiences.includes(user.audience)).map(
      ({ run: _run, ...definition }) => definition,
    );
  }

  async preview(user: SessionUser, code: string, input: ReportFilterInput) {
    const report = this.definition(user, code);
    const rows = await report.run({
      prisma: this.prisma,
      scope: await this.scopes.resolve(user),
      filters: toFilters(input),
      limit: PREVIEW_LIMIT + 1,
    });
    return {
      columns: report.columns,
      rows: rows.slice(0, PREVIEW_LIMIT),
      truncated: rows.length > PREVIEW_LIMIT,
    };
  }

  async export(
    user: SessionUser,
    code: string,
    input: ReportFilterInput,
    format: ExportFormat,
  ): Promise<ExportedReport> {
    const report = this.definition(user, code);
    const rows = await report.run({
      prisma: this.prisma,
      scope: await this.scopes.resolve(user),
      filters: toFilters(input),
      limit: EXPORT_LIMIT,
    });
    await this.audit.record({
      action: 'REPORT_EXPORTED',
      entityType: 'Report',
      entityId: code,
      after: { format, filters: input, rows: rows.length },
    });
    return this.exporter.export(report, rows, format, describeFilters(input, user.fullName));
  }

  listSchedules() {
    return this.prisma.reportSchedule.findMany({ orderBy: { name: 'asc' } });
  }

  async createSchedule(user: SessionUser, input: ScheduleInput): Promise<ReportSchedule> {
    const report = REPORTS.find(
      (r) => r.code === input.reportCode && r.audiences.includes('BACKOFFICE'),
    );
    if (!report) {
      throw new BusinessRuleError('UNKNOWN_REPORT', 'Unknown report');
    }
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.reportSchedule.create({
        data: {
          reportCode: input.reportCode,
          name: input.name.trim(),
          frequency: input.frequency,
          format: input.format,
          recipients: [...new Set(input.recipients.map((r) => r.trim().toLowerCase()))],
          filters: { period: input.period },
          nextRunAt: nextRun(input.frequency, new Date()),
          createdById: user.id,
        },
      });
      await this.audit.record(
        {
          action: 'REPORT_SCHEDULE_CREATED',
          entityType: 'ReportSchedule',
          entityId: schedule.id,
          after: schedule,
        },
        tx,
      );
      return schedule;
    });
  }

  async setScheduleActive(id: string, active: boolean) {
    const schedule = await this.prisma.reportSchedule.findUnique({ where: { id } });
    if (!schedule) {
      throw notFound('Report schedule');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.reportSchedule.update({
        where: { id },
        data: {
          active,
          nextRunAt: active ? nextRun(schedule.frequency, new Date()) : schedule.nextRunAt,
        },
      });
      await this.audit.record(
        {
          action: active ? 'REPORT_SCHEDULE_RESUMED' : 'REPORT_SCHEDULE_PAUSED',
          entityType: 'ReportSchedule',
          entityId: id,
        },
        tx,
      );
      return updated;
    });
  }

  @Cron('0 */15 * * * *', { name: 'scheduled-reports', timeZone: BUSINESS_TIME_ZONE })
  async scheduledRun(): Promise<void> {
    if (!this.config.jobs.enabled) {
      return;
    }
    await this.prisma.withJobLock('scheduled-reports', () => this.runDueSchedules());
  }

  async runDueSchedules(): Promise<void> {
    const due = await this.prisma.reportSchedule.findMany({
      where: { active: true, nextRunAt: { lte: new Date() } },
    });
    for (const schedule of due) {
      try {
        await this.runSchedule(schedule);
      } catch (error) {
        this.logger.error(`Scheduled report ${schedule.name} failed: ${(error as Error).message}`);
      }
      await this.prisma.reportSchedule.update({
        where: { id: schedule.id },
        data: { lastRunAt: new Date(), nextRunAt: nextRun(schedule.frequency, new Date()) },
      });
    }
  }

  private async runSchedule(schedule: ReportSchedule): Promise<void> {
    const report = REPORTS.find((r) => r.code === schedule.reportCode)!;
    const period = (schedule.filters as { period?: SchedulePeriod }).period ?? 'PREVIOUS_DAY';
    const input = periodToFilters(period);
    const rows = await report.run({
      prisma: this.prisma,
      scope: UNRESTRICTED,
      filters: toFilters(input),
      limit: EXPORT_LIMIT,
    });
    const exported = await this.exporter.export(
      report,
      rows,
      schedule.format,
      describeFilters(input, `schedule "${schedule.name}"`),
    );
    await this.prisma.$transaction(async (tx) => {
      const document = await this.documents.storeGenerated(tx, {
        ownerType: 'REPORT',
        ownerId: schedule.id,
        docType: 'SCHEDULED_REPORT',
        fileName: exported.fileName,
        mimeType: exported.mimeType,
        content: exported.content,
      });
      for (const recipient of schedule.recipients) {
        await this.notifications.emailExternal(tx, recipient, {
          eventType: 'SCHEDULED_REPORT',
          subject: `${schedule.name} – ${toIsoDate(businessToday())}`,
          body: `Please find attached the ${report.name} report (${rows.length} record(s)).`,
          attachmentIds: [document.id],
        });
      }
    });
  }

  private definition(user: SessionUser, code: string): ReportDefinition {
    const report = REPORTS.find((r) => r.code === code);
    if (!report) {
      throw notFound('Report');
    }
    if (!report.audiences.includes(user.audience)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This report is not available to you',
      });
    }
    return report;
  }
}

function toFilters(input: ReportFilterInput): ReportFilters {
  return {
    from: input.from ? parseIsoDate(input.from) : undefined,
    to: input.to ? addDays(parseIsoDate(input.to), 1) : undefined,
    productId: input.productId,
    agencyId: input.agencyId,
    agentId: input.agentId,
    status: input.status,
  };
}

function describeFilters(input: ReportFilterInput, requestedBy: string): string {
  const period =
    input.from || input.to ? `Period ${input.from ?? '…'} to ${input.to ?? '…'}` : 'All dates';
  return `${period} · Produced ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC for ${requestedBy}`;
}

export function periodToFilters(
  period: SchedulePeriod,
  today = businessToday(),
): ReportFilterInput {
  const iso = toIsoDate;
  switch (period) {
    case 'PREVIOUS_7_DAYS':
      return { from: iso(addDays(today, -7)), to: iso(addDays(today, -1)) };
    case 'PREVIOUS_MONTH': {
      const firstOfThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      const firstOfPrevious = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      return { from: iso(firstOfPrevious), to: iso(addDays(firstOfThisMonth, -1)) };
    }
    case 'MONTH_TO_DATE':
      return {
        from: iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
        to: iso(today),
      };
    default:
      return { from: iso(addDays(today, -1)), to: iso(addDays(today, -1)) };
  }
}

/** Next delivery: daily at 07:00 Brunei time, weekly on Monday, monthly on the 1st. */
export function nextRun(frequency: ReportFrequency, after: Date): Date {
  let candidate = new Date(
    Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate(), SCHEDULE_HOUR_UTC),
  );
  // At most 32 days ahead covers the monthly case.
  for (let day = 0; day < 32; day++) {
    if (candidate > after && matches(frequency, new Date(candidate.getTime() + 8 * 3_600_000))) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + 86_400_000);
  }
  throw new Error(`Cannot schedule ${frequency} report`);
}

function matches(frequency: ReportFrequency, local: Date): boolean {
  if (frequency === 'WEEKLY') return local.getUTCDay() === 1;
  if (frequency === 'MONTHLY') return local.getUTCDate() === 1;
  return true;
}
