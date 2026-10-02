import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.js';
import { normaliseIdentifier } from '../../common/crypto/field-crypto.service.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { pageArgs, type PageQueryDto, toPage } from '../../common/http/pagination.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import type { AmlScreening, Prisma } from '../../generated/prisma/client.js';
import type { AmlCaseStatus, AmlStatus } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import { nameSimilarity, normaliseName } from './name-matching.js';

export type AmlSubjectType = 'AGENT' | 'PARTICIPANT';

export interface AmlSubject {
  type: AmlSubjectType;
  id: string;
  name: string;
  idNumber: string;
  dateOfBirth?: Date | null;
  nationality?: string | null;
}

export interface WatchlistMatch {
  listName: string;
  name: string;
  score: number;
  reference?: string | null;
  reason: 'NAME' | 'ID_NUMBER';
}

export interface ScreeningOutcome {
  status: Extract<AmlStatus, 'CLEAR' | 'FLAGGED'>;
  screening: AmlScreening;
}

const MAX_MATCHES = 10;

/**
 * AML/KYC screening (AP-16, AP-48, BO-13..15). Every new agent and participant is
 * screened against the watch-lists maintained by Compliance (UN, local and internal
 * lists) and, when configured, an external screening service. Potential matches at or
 * above the configured score are routed to Compliance for review.
 */
@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async screen(db: Db, subject: AmlSubject): Promise<ScreeningOutcome> {
    const threshold = await this.settings.getInt(Setting.AmlMatchThreshold);
    const internal = await this.screenWatchlist(db, subject);
    const external = await this.screenExternal(subject);
    const matches = [...internal, ...external.matches]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_MATCHES);
    const score = matches[0]?.score ?? 0;
    const flagged = score >= threshold;

    const screening = await db.amlScreening.create({
      data: {
        subjectType: subject.type,
        subjectId: subject.id,
        subjectName: subject.name,
        provider: external.provider ? `WATCHLIST+${external.provider}` : 'WATCHLIST',
        score,
        matches: matches as unknown as Prisma.InputJsonValue,
        status: flagged ? 'PENDING_REVIEW' : 'AUTO_CLEARED',
      },
    });
    const status = flagged ? 'FLAGGED' : 'CLEAR';
    await this.updateSubject(db, subject.type, subject.id, status);
    await this.audit.record(
      {
        action: 'AML_SCREENED',
        entityType: subject.type,
        entityId: subject.id,
        after: { score, status },
      },
      db,
    );

    if (flagged) {
      await this.notifications.notifyPermissionHolders(db, Permission.BoAmlReview, {
        eventType: 'AML_REVIEW_REQUIRED',
        subject: 'AML screening requires review',
        body: `${subject.type === 'AGENT' ? 'Agent' : 'Participant'} "${subject.name}" has a potential watch-list match (score ${score}).`,
        link: '/backoffice/aml',
        channels: ['EMAIL'],
      });
    }
    return { status, screening };
  }

  async cases(query: PageQueryDto, status?: AmlCaseStatus) {
    const where = { status: status ?? 'PENDING_REVIEW' };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.amlScreening.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        ...pageArgs(query),
      }),
      this.prisma.amlScreening.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  historyFor(subjectType: AmlSubjectType, subjectId: string) {
    return this.prisma.amlScreening.findMany({
      where: { subjectType, subjectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** BO-15: Compliance clears a false positive or confirms the match (subject rejected). */
  async review(
    user: SessionUser,
    screeningId: string,
    decision: 'CLEARED' | 'CONFIRMED_MATCH',
    remarks: string,
  ): Promise<AmlScreening> {
    if (!remarks.trim()) {
      throw new BusinessRuleError('REMARKS_REQUIRED', 'Review remarks are required');
    }
    return this.prisma.$transaction(async (tx) => {
      const screening = await tx.amlScreening.findUnique({ where: { id: screeningId } });
      if (!screening) {
        throw notFound('Screening');
      }
      if (screening.status !== 'PENDING_REVIEW') {
        throw new BusinessRuleError('ALREADY_REVIEWED', 'This case has already been reviewed');
      }
      const updated = await tx.amlScreening.update({
        where: { id: screeningId },
        data: {
          status: decision,
          reviewedById: user.id,
          reviewedAt: new Date(),
          reviewRemarks: remarks.trim(),
        },
      });
      await this.updateSubject(
        tx,
        screening.subjectType as AmlSubjectType,
        screening.subjectId,
        decision === 'CLEARED' ? 'CLEAR' : 'REJECTED',
      );
      await this.audit.record(
        {
          action: 'AML_REVIEWED',
          entityType: screening.subjectType,
          entityId: screening.subjectId,
          after: { decision, remarks },
        },
        tx,
      );
      return updated;
    });
  }

  private async screenWatchlist(db: Db, subject: AmlSubject): Promise<WatchlistMatch[]> {
    const normalised = normaliseName(subject.name);
    const firstToken = normalised.split(' ')[0] ?? '';
    const idNumber = normaliseIdentifier(subject.idNumber);
    // Candidate pre-selection keeps the comparison set small as lists grow.
    const candidates = await db.amlWatchlistEntry.findMany({
      where: {
        active: true,
        OR: [
          { idNumber },
          { normalised: { contains: firstToken } },
          { normalised: { contains: normalised.split(' ').at(-1) ?? '' } },
        ],
      },
      take: 500,
    });
    const matches: WatchlistMatch[] = [];
    for (const entry of candidates) {
      if (entry.idNumber && normaliseIdentifier(entry.idNumber) === idNumber) {
        matches.push({
          listName: entry.listName,
          name: entry.fullName,
          score: 100,
          reference: entry.reference,
          reason: 'ID_NUMBER',
        });
        continue;
      }
      const score = nameSimilarity(subject.name, entry.fullName);
      if (score >= 60) {
        matches.push({
          listName: entry.listName,
          name: entry.fullName,
          score,
          reference: entry.reference,
          reason: 'NAME',
        });
      }
    }
    return matches;
  }

  /** Optional external screening service (e.g. a commercial sanctions/PEP database). */
  private async screenExternal(
    subject: AmlSubject,
  ): Promise<{ provider?: string; matches: WatchlistMatch[] }> {
    const endpoint = this.config.integration.aml;
    if (!endpoint || this.config.integration.mode === 'simulated') {
      return { matches: [] };
    }
    const started = Date.now();
    try {
      const response = await fetch(`${endpoint.baseUrl}/screen`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': endpoint.apiKey },
        body: JSON.stringify({
          name: subject.name,
          idNumber: subject.idNumber,
          dateOfBirth: subject.dateOfBirth?.toISOString().slice(0, 10),
          nationality: subject.nationality,
        }),
        signal: AbortSignal.timeout(endpoint.timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const body = (await response.json()) as {
        matches?: { listName: string; name: string; score: number; reference?: string }[];
      };
      await this.logCall(true, Date.now() - started);
      return {
        provider: 'EXTERNAL',
        matches: (body.matches ?? []).map((m) => ({
          ...m,
          score: Math.round(m.score),
          reason: 'NAME' as const,
        })),
      };
    } catch (error) {
      // The screening is not silently skipped: an unavailable provider forces manual review.
      this.logger.warn(`External AML screening failed: ${(error as Error).message}`);
      await this.logCall(false, Date.now() - started, (error as Error).message);
      return {
        provider: 'EXTERNAL_UNAVAILABLE',
        matches: [
          {
            listName: 'EXTERNAL',
            name: 'Screening service unavailable',
            score: 100,
            reason: 'NAME',
          },
        ],
      };
    }
  }

  private async logCall(
    success: boolean,
    durationMs: number,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.integrationLog.create({
      data: {
        system: 'AML',
        operation: 'SCREEN',
        direction: 'OUTBOUND',
        success,
        durationMs,
        errorMessage: errorMessage?.slice(0, 1000),
      },
    });
  }

  private async updateSubject(
    db: Db,
    type: AmlSubjectType,
    id: string,
    amlStatus: AmlStatus,
  ): Promise<void> {
    if (type === 'AGENT') {
      await db.agent.update({ where: { id }, data: { amlStatus } });
    } else {
      await db.participant.update({
        where: { id },
        data: { amlStatus, amlScreenedAt: new Date() },
      });
    }
  }
}
