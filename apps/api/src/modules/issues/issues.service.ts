import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AppConfig } from '../../config/app-config.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, type PageQueryDto, toPage } from '../../common/http/pagination.js';
import { NumberingService } from '../../common/numbering/numbering.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Permission } from '../../common/security/permissions.js';
import { hasPermission, type SessionUser } from '../../common/security/session-user.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { IssuePriority, IssueStatus } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { MasterDataService } from '../settings/master-data.service.js';
import { Setting, type SettingKey } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';

const SLA_SETTINGS: Record<IssuePriority, { response: SettingKey; resolution: SettingKey }> = {
  CRITICAL: {
    response: Setting.SlaCriticalResponseHours,
    resolution: Setting.SlaCriticalResolutionHours,
  },
  HIGH: { response: Setting.SlaHighResponseHours, resolution: Setting.SlaHighResolutionHours },
  MEDIUM: {
    response: Setting.SlaMediumResponseHours,
    resolution: Setting.SlaMediumResolutionHours,
  },
  LOW: { response: Setting.SlaLowResponseHours, resolution: Setting.SlaLowResolutionHours },
};

export interface IssueInput {
  title: string;
  description: string;
  category: string;
  priority: IssuePriority;
}

export interface IssueFilter {
  status?: IssueStatus;
  priority?: IssuePriority;
  assignedToMe?: boolean;
  breachedOnly?: boolean;
  search?: string;
}

/**
 * Issue management (AP-55..57, BO-29..31): reference number, priority-based SLA
 * targets, assignment, comments (internal or visible to the reporter) and SLA breach
 * monitoring with alerts.
 */
@Injectable()
export class IssuesService {
  private readonly logger = new Logger(IssuesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly numbering: NumberingService,
    private readonly settings: SettingsService,
    private readonly masterData: MasterDataService,
    private readonly documents: DocumentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(user: SessionUser, input: IssueInput) {
    await this.masterData.assertValid('ISSUE_CATEGORY', input.category);
    const now = new Date();
    const due = await this.dueDates(input.priority, now);
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.create({
        data: {
          issueNo: await this.numbering.next(tx, 'issue'),
          title: input.title.trim(),
          description: input.description.trim(),
          category: input.category,
          priority: input.priority,
          reportedById: user.id,
          reportedByName: user.fullName,
          agencyId: user.agencyId ?? null,
          responseDueAt: due.response,
          resolutionDueAt: due.resolution,
          createdAt: now,
        },
      });
      await this.notifications.notifyPermissionHolders(tx, Permission.BoIssuesManage, {
        eventType: 'ISSUE_REPORTED',
        subject: `${input.priority} issue ${issue.issueNo}: ${issue.title}`,
        body: `Reported by ${user.fullName}. Response due ${due.response.toISOString()}.`,
        link: `/backoffice/issues/${issue.id}`,
        channels: input.priority === 'CRITICAL' ? ['EMAIL', 'SMS'] : ['EMAIL'],
      });
      await this.audit.record(
        {
          action: 'ISSUE_REPORTED',
          entityType: 'Issue',
          entityId: issue.id,
          after: { issueNo: issue.issueNo, priority: issue.priority },
        },
        tx,
      );
      return issue;
    });
  }

  async list(user: SessionUser, query: PageQueryDto, filter: IssueFilter) {
    const manager = this.isManager(user);
    const search = filter.search?.trim();
    const where: Prisma.IssueWhereInput = {
      reportedById: manager ? undefined : user.id,
      assignedToId: manager && filter.assignedToMe ? user.id : undefined,
      status: filter.status,
      priority: filter.priority,
      slaBreached: filter.breachedOnly ? true : undefined,
      OR: search
        ? [
            { issueNo: { contains: search, mode: 'insensitive' } },
            { title: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.issue.findMany({
        where,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        ...pageArgs(query),
      }),
      this.prisma.issue.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async detail(user: SessionUser, id: string) {
    const issue = await this.accessible(user, id);
    const comments = await this.prisma.issueComment.findMany({
      where: { issueId: id, internal: this.isManager(user) ? undefined : false },
      orderBy: { createdAt: 'asc' },
    });
    const documents = await this.documents.listForOwnerUnchecked(this.prisma, 'ISSUE', id);
    return { ...issue, comments, documents };
  }

  async comment(user: SessionUser, id: string, body: string, internal: boolean) {
    const issue = await this.accessible(user, id);
    const manager = this.isManager(user);
    if (internal && !manager) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Only support staff can add internal notes',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.issueComment.create({
        data: {
          issueId: id,
          authorId: user.id,
          authorName: user.fullName,
          body: body.trim(),
          internal,
        },
      });
      if (manager && !issue.firstRespondedAt && !internal) {
        await tx.issue.update({ where: { id }, data: { firstRespondedAt: new Date() } });
      }
      if (!internal && user.id !== issue.reportedById) {
        await this.notifications.notifyUser(tx, issue.reportedById, {
          eventType: 'ISSUE_UPDATED',
          subject: `Update on ${issue.issueNo}`,
          body: body.slice(0, 300),
          link: `/issues/${id}`,
        });
      }
      return comment;
    });
  }

  /** BO-29: assignment counts as first response if none was given yet. */
  async assign(id: string, assigneeId: string, team?: string) {
    const assignee = await this.prisma.user.findFirst({
      where: {
        id: assigneeId,
        userType: 'STAFF',
        status: 'ACTIVE',
        roles: {
          some: { role: { permissions: { some: { permission: Permission.BoIssuesManage } } } },
        },
      },
    });
    if (!assignee) {
      throw new BusinessRuleError(
        'INVALID_ASSIGNEE',
        'The assignee must be an active support user',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const issue = await tx.issue.findUniqueOrThrow({ where: { id } });
      const updated = await tx.issue.update({
        where: { id },
        data: {
          assignedToId: assignee.id,
          assignedToName: assignee.fullName,
          assignedTeam: team,
          status: issue.status === 'OPEN' ? 'ASSIGNED' : issue.status,
          firstRespondedAt: issue.firstRespondedAt ?? new Date(),
        },
      });
      await this.notifications.notifyUser(tx, assignee.id, {
        eventType: 'ISSUE_ASSIGNED',
        subject: `${issue.issueNo} assigned to you`,
        body: `${issue.priority}: ${issue.title}. Resolution due ${issue.resolutionDueAt.toISOString()}.`,
        link: `/backoffice/issues/${id}`,
        channels: ['EMAIL'],
      });
      await this.audit.record(
        {
          action: 'ISSUE_ASSIGNED',
          entityType: 'Issue',
          entityId: id,
          before: { assignedTo: issue.assignedToName },
          after: { assignedTo: assignee.fullName, team },
        },
        tx,
      );
      return updated;
    });
  }

  /** BO-30: re-prioritising recalculates the SLA targets from the reporting time. */
  async setPriority(id: string, priority: IssuePriority) {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue) {
      throw notFound('Issue');
    }
    const due = await this.dueDates(priority, issue.createdAt);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id },
        data: {
          priority,
          responseDueAt: due.response,
          resolutionDueAt: due.resolution,
          slaBreached: false,
        },
      });
      await this.audit.record(
        {
          action: 'ISSUE_REPRIORITISED',
          entityType: 'Issue',
          entityId: id,
          before: { priority: issue.priority },
          after: { priority },
        },
        tx,
      );
      return updated;
    });
  }

  async setStatus(user: SessionUser, id: string, status: IssueStatus, resolution?: string) {
    const issue = await this.accessible(user, id);
    const manager = this.isManager(user);
    if (!manager) {
      // Reporters can only confirm a resolution (close) or reopen it.
      if (issue.status !== 'RESOLVED' || !['CLOSED', 'IN_PROGRESS'].includes(status)) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'You can close or reopen an issue once it is resolved',
        });
      }
    }
    if (status === 'RESOLVED' && !resolution?.trim()) {
      throw new BusinessRuleError('RESOLUTION_REQUIRED', 'Describe the resolution');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.issue.update({
        where: { id },
        data: {
          status,
          resolution: status === 'RESOLVED' ? resolution!.trim() : undefined,
          resolvedAt:
            status === 'RESOLVED' ? new Date() : status === 'IN_PROGRESS' ? null : undefined,
          closedAt: status === 'CLOSED' ? new Date() : undefined,
        },
      });
      await this.audit.record(
        {
          action: 'ISSUE_STATUS_CHANGED',
          entityType: 'Issue',
          entityId: id,
          before: { status: issue.status },
          after: { status, resolution },
        },
        tx,
      );
      if (user.id !== issue.reportedById) {
        await this.notifications.notifyUser(tx, issue.reportedById, {
          eventType: 'ISSUE_UPDATED',
          subject: `${issue.issueNo} is now ${status.replace('_', ' ').toLowerCase()}`,
          body: resolution ?? 'The status of your issue has changed.',
          link: `/issues/${id}`,
          channels: status === 'RESOLVED' ? ['EMAIL'] : undefined,
        });
      }
      return updated;
    });
  }

  async assignees() {
    return this.prisma.user.findMany({
      where: {
        userType: 'STAFF',
        status: 'ACTIVE',
        roles: {
          some: { role: { permissions: { some: { permission: Permission.BoIssuesManage } } } },
        },
      },
      select: { id: true, fullName: true, username: true },
      orderBy: { fullName: 'asc' },
    });
  }

  /** BO-31: flags issues that missed their response or resolution target and alerts support. */
  @Interval('issue-sla-monitor', 5 * 60_000)
  async scheduledRun(): Promise<void> {
    if (!this.config.jobs.enabled) {
      return;
    }
    await this.prisma.withJobLock('issue-sla-monitor', async () => {
      await this.flagBreaches();
    });
  }

  async flagBreaches(): Promise<number> {
    const now = new Date();
    const breached = await this.prisma.issue.findMany({
      where: {
        slaBreached: false,
        status: { notIn: ['RESOLVED', 'CLOSED'] },
        OR: [
          { firstRespondedAt: null, responseDueAt: { lt: now } },
          { resolutionDueAt: { lt: now } },
        ],
      },
    });
    for (const issue of breached) {
      await this.prisma.$transaction(async (tx) => {
        await tx.issue.update({ where: { id: issue.id }, data: { slaBreached: true } });
        const message = {
          eventType: 'ISSUE_SLA_BREACHED',
          subject: `SLA breached: ${issue.issueNo}`,
          body: `${issue.priority} issue "${issue.title}" has missed its ${issue.firstRespondedAt ? 'resolution' : 'response'} target.`,
          link: `/backoffice/issues/${issue.id}`,
          channels: ['EMAIL' as const],
        };
        await this.notifications.notifyPermissionHolders(tx, Permission.BoIssuesManage, message);
      });
    }
    if (breached.length > 0) {
      this.logger.warn(`${breached.length} issue(s) breached SLA`);
    }
    return breached.length;
  }

  private async dueDates(priority: IssuePriority, from: Date) {
    const keys = SLA_SETTINGS[priority];
    const responseHours = await this.settings.getInt(keys.response);
    const resolutionHours = await this.settings.getInt(keys.resolution);
    return {
      response: new Date(from.getTime() + responseHours * 3_600_000),
      resolution: new Date(from.getTime() + resolutionHours * 3_600_000),
    };
  }

  private isManager(user: SessionUser): boolean {
    return user.audience === 'BACKOFFICE' && hasPermission(user, Permission.BoIssuesManage);
  }

  private async accessible(user: SessionUser, id: string) {
    const issue = await this.prisma.issue.findUnique({ where: { id } });
    if (!issue || (!this.isManager(user) && issue.reportedById !== user.id)) {
      throw notFound('Issue');
    }
    return issue;
  }
}
