import type { Prisma } from '../../../generated/prisma/client.js';
import type { ParticipantType } from '../../../generated/prisma/enums.js';

/** Facts about the participant and cover start that rating rules depend on. */
export interface RatingContext {
  participantType: ParticipantType;
  dateOfBirth: Date | null;
  nationality: string | null;
  occupationClass: number | null;
  startDate: Date;
}

export interface QuoteRequest {
  planCode?: string;
  coverageType?: string;
  termMonths?: number;
  additionalCover?: boolean;
  riskDetails: Record<string, unknown>;
}

export interface ContributionLine {
  label: string;
  amount: string;
}

export interface QuoteResult {
  planCode: string | null;
  coverageType: string | null;
  termMonths: number;
  sumCovered: Prisma.Decimal;
  contribution: Prisma.Decimal;
  lines: ContributionLine[];
  tabarru: Prisma.Decimal;
  wakalahFee: Prisma.Decimal;
  riskDetails: Record<string, string | number | boolean>;
  /** Reasons the case must be referred to IIFT before issuance (authority/high-risk limits). */
  referralReasons: string[];
  commissionRate: number;
}

export interface RatingEngine {
  readonly code: string;
  /** Throws a descriptive error if a product configuration is invalid for this engine. */
  validateConfig(config: unknown): void;
  /** Throws BusinessRuleError('NOT_ELIGIBLE') with every failed rule when the case is not eligible. */
  quote(config: unknown, request: QuoteRequest, context: RatingContext): QuoteResult;
}
