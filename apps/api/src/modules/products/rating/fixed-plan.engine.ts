import { ageNextBirthday } from '../../../common/util/dates.js';
import { money, sum } from '../../../common/util/money.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { ConfigReader } from './config-reader.js';
import {
  assertEligible,
  readRiskFieldDefinitions,
  readRiskFields,
  type RiskFieldDefinition,
} from './risk-fields.js';
import type {
  ContributionLine,
  QuoteRequest,
  QuoteResult,
  RatingContext,
  RatingEngine,
} from './rating.types.js';

interface Plan {
  code: string;
  name: string;
  sumCovered: number;
  contributions: Map<number, number>;
  additionalCover?: { name: string; amount: number };
}

interface CoverageType {
  code: string;
  name: string;
  loading: number;
}

interface Eligibility {
  minAge?: number;
  maxAge?: number;
  occupationClasses?: number[];
  nationalities?: string[];
  participantTypes?: string[];
}

interface FixedPlanConfig {
  plans: Plan[];
  coverageTypes: CoverageType[];
  terms: number[];
  eligibility: Eligibility;
  wakalahPercent: number;
  commissionRate: number;
  riskFields: RiskFieldDefinition[];
}

/**
 * Annual individual plans with a published contribution per plan and period
 * (FFR02 Personal Home Assistant, FFR03 Professional, FFR04 Khairat, FFR05 Overseas
 * Student Assist). Optional coverage-type loading (e.g. Khairat "Wider (Child)") and
 * optional additional cover (e.g. Professional Plan A/B/C add-on at B$90/120/140).
 */
export class FixedPlanRatingEngine implements RatingEngine {
  readonly code = 'FIXED_PLAN';

  validateConfig(config: unknown): void {
    this.read(config);
  }

  quote(rawConfig: unknown, request: QuoteRequest, context: RatingContext): QuoteResult {
    const config = this.read(rawConfig);
    const errors: string[] = [];

    const plan = config.plans.find((candidate) => candidate.code === request.planCode);
    if (!plan)
      errors.push(`Choose one of the plans: ${config.plans.map((p) => p.name).join(', ')}`);

    const termMonths = request.termMonths ?? config.terms[0];
    if (!config.terms.includes(termMonths))
      errors.push(
        `Coverage period must be ${config.terms.map((t) => `${t / 12} year(s)`).join(' or ')}`,
      );

    const coverageType =
      config.coverageTypes.length > 0
        ? config.coverageTypes.find((type) => type.code === request.coverageType)
        : undefined;
    if (config.coverageTypes.length > 0 && !coverageType) {
      errors.push(
        `Choose a coverage type: ${config.coverageTypes.map((t) => t.name).join(' or ')}`,
      );
    }
    if (request.additionalCover && plan && !plan.additionalCover) {
      errors.push('Additional cover is not available for this plan');
    }

    errors.push(...this.eligibilityErrors(config.eligibility, context));
    const risk = readRiskFields(config.riskFields, request.riskDetails);
    errors.push(...risk.errors);
    assertEligible(errors);

    const base = new Prisma.Decimal(plan!.contributions.get(termMonths) ?? 0);
    if (base.isZero()) {
      assertEligible([`No contribution is defined for ${plan!.name} over ${termMonths} months`]);
    }
    const lines: ContributionLine[] = [
      { label: `${plan!.name} – ${termMonths / 12} year(s)`, amount: money(base).toFixed(2) },
    ];
    let loaded = base;
    if (coverageType && coverageType.loading !== 1) {
      loaded = base.times(coverageType.loading);
      lines.push({
        label: `${coverageType.name} coverage loading (×${coverageType.loading})`,
        amount: money(loaded.minus(base)).toFixed(2),
      });
    }
    const additional =
      request.additionalCover && plan!.additionalCover
        ? new Prisma.Decimal(plan!.additionalCover.amount)
        : new Prisma.Decimal(0);
    if (!additional.isZero()) {
      lines.push({ label: plan!.additionalCover!.name, amount: money(additional).toFixed(2) });
    }

    const contribution = sum([loaded, additional]);
    const wakalahFee = money(contribution.times(config.wakalahPercent).dividedBy(100));
    return {
      planCode: plan!.code,
      coverageType: coverageType?.code ?? null,
      termMonths,
      sumCovered: money(plan!.sumCovered),
      contribution,
      wakalahFee,
      tabarru: money(contribution.minus(wakalahFee)),
      lines,
      riskDetails: {
        ...risk.values,
        additionalCover: Boolean(request.additionalCover && plan!.additionalCover),
      },
      referralReasons: [],
      commissionRate: config.commissionRate,
    };
  }

  private eligibilityErrors(rules: Eligibility, context: RatingContext): string[] {
    const errors: string[] = [];
    if (rules.participantTypes && !rules.participantTypes.includes(context.participantType)) {
      errors.push(
        `Available to ${rules.participantTypes.join('/').toLowerCase()} participants only`,
      );
    }
    if (rules.minAge !== undefined || rules.maxAge !== undefined) {
      if (!context.dateOfBirth) {
        errors.push('Participant date of birth is required');
      } else {
        const age = ageNextBirthday(context.dateOfBirth, context.startDate);
        if (
          (rules.minAge !== undefined && age < rules.minAge) ||
          (rules.maxAge !== undefined && age > rules.maxAge)
        ) {
          errors.push(
            `Age next birthday must be between ${rules.minAge ?? 0} and ${rules.maxAge ?? 100} (participant: ${age})`,
          );
        }
      }
    }
    if (
      rules.occupationClasses &&
      !rules.occupationClasses.includes(context.occupationClass ?? 0)
    ) {
      errors.push(`Only occupational class ${rules.occupationClasses.join(', ')} is eligible`);
    }
    if (rules.nationalities && !rules.nationalities.includes(context.nationality ?? '')) {
      errors.push(`Only ${rules.nationalities.join(', ').toLowerCase()} nationals are eligible`);
    }
    return errors;
  }

  private read(raw: unknown): FixedPlanConfig {
    const reader = new ConfigReader(raw);
    const terms = reader.numberArray('terms');
    const plans = reader.array('plans').map((plan) => {
      const contributions = plan.child('contributions')!;
      const additional = plan.child('additionalCover', true);
      return {
        code: plan.string('code'),
        name: plan.string('name'),
        sumCovered: plan.number('sumCovered', { min: 0 }),
        contributions: new Map(
          terms.map((term) => [term, contributions.number(String(term), { min: 0 })]),
        ),
        additionalCover: additional
          ? { name: additional.string('name'), amount: additional.number('amount', { min: 0 }) }
          : undefined,
      };
    });
    const eligibility = reader.child('eligibility', true);
    return {
      plans,
      terms,
      coverageTypes: reader.optionalArray('coverageTypes').map((type) => ({
        code: type.string('code'),
        name: type.string('name'),
        loading: type.number('loading', { min: 0.1, max: 10 }),
      })),
      eligibility: {
        minAge: eligibility
          ? optionalNumber(eligibility.number('minAge', { optional: true, min: 0 }))
          : undefined,
        maxAge: eligibility
          ? optionalNumber(eligibility.number('maxAge', { optional: true, min: 0 }))
          : undefined,
        occupationClasses: eligibility?.has('occupationClasses')
          ? eligibility.numberArray('occupationClasses')
          : undefined,
        nationalities: eligibility?.has('nationalities')
          ? eligibility.stringArray('nationalities')
          : undefined,
        participantTypes: eligibility?.has('participantTypes')
          ? eligibility.stringArray('participantTypes')
          : undefined,
      },
      wakalahPercent: reader.number('wakalahPercent', { min: 0, max: 100 }),
      commissionRate: reader.number('commissionRate', { min: 0, max: 1 }),
      riskFields: readRiskFieldDefinitions((raw as { riskFields?: unknown }).riskFields),
    };
  }
}

/** ConfigReader returns NaN for an absent optional number. */
function optionalNumber(value: number): number | undefined {
  return Number.isNaN(value) ? undefined : value;
}
