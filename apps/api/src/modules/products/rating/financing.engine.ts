import { ageNextBirthday } from '../../../common/util/dates.js';
import { money } from '../../../common/util/money.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { ConfigReader } from './config-reader.js';
import {
  assertEligible,
  readRiskFieldDefinitions,
  readRiskFields,
  type RiskFieldDefinition,
} from './risk-fields.js';
import type { QuoteRequest, QuoteResult, RatingContext, RatingEngine } from './rating.types.js';

interface AgeBand {
  maxAge: number;
  ratePerMille: number;
}

interface FinancingConfig {
  profitBasis: 'FLAT' | 'NONE';
  highRiskLimit: number;
  minFinancing: number;
  maxFinancing: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  minAge: number;
  maxEntryAge: number;
  maxAgeAtExpiry: number;
  rateTable: AgeBand[];
  decreasingFactor: number;
  wakalahPercent: number;
  minimumContribution: number;
  commissionRate: number;
  riskFields: RiskFieldDefinition[];
}

/** Keys the engine itself relies on; every financing product must capture them. */
const CORE_FIELDS = ['financingAmount', 'tenureMonths', 'profitRatePercent'];

/**
 * Decreasing-term financing takaful (FFR01: Hire Purchase, Non-Participating, Property
 * Financing). Contribution is a single amount for the whole financing tenure:
 *
 *   sum covered   = financing amount (+ flat profit for hire purchase)
 *   contribution  = sum covered / 1,000 × rate(age next birthday) × years × decreasing factor
 *
 * Financing above the high-risk limit (B$150,000 by default) is referred to the IIFT
 * Sales team instead of being issued by the agent/banker.
 */
export class FinancingRatingEngine implements RatingEngine {
  readonly code = 'FINANCING';

  validateConfig(config: unknown): void {
    this.read(config);
  }

  quote(rawConfig: unknown, request: QuoteRequest, context: RatingContext): QuoteResult {
    const config = this.read(rawConfig);
    const { values, errors } = readRiskFields(config.riskFields, request.riskDetails);
    assertEligible(errors);

    const amount = Number(values.financingAmount);
    const tenureMonths = Number(values.tenureMonths);
    const profitRate = Number(values.profitRatePercent);
    const years = tenureMonths / 12;

    if (context.participantType !== 'INDIVIDUAL' || !context.dateOfBirth) {
      assertEligible(['Financing takaful covers an individual participant with a date of birth']);
    }
    const age = ageNextBirthday(context.dateOfBirth!, context.startDate);
    const rules: string[] = [];
    if (age < config.minAge || age > config.maxEntryAge) {
      rules.push(
        `Age next birthday must be between ${config.minAge} and ${config.maxEntryAge} (participant: ${age})`,
      );
    }
    if (age + Math.ceil(years) > config.maxAgeAtExpiry) {
      rules.push(`Cover must end by age ${config.maxAgeAtExpiry}; reduce the tenure`);
    }
    if (amount < config.minFinancing || amount > config.maxFinancing) {
      rules.push(
        `Financing amount must be between B$${config.minFinancing.toLocaleString('en-GB')} and B$${config.maxFinancing.toLocaleString('en-GB')}`,
      );
    }
    if (
      !Number.isInteger(tenureMonths) ||
      tenureMonths < config.minTenureMonths ||
      tenureMonths > config.maxTenureMonths
    ) {
      rules.push(
        `Tenure must be a whole number of months between ${config.minTenureMonths} and ${config.maxTenureMonths}`,
      );
    }
    assertEligible(rules);

    const principal = new Prisma.Decimal(amount);
    const sumCovered = money(
      config.profitBasis === 'FLAT' ? principal.times(1 + (profitRate / 100) * years) : principal,
    );
    const rate = config.rateTable.find((band) => age <= band.maxAge)!.ratePerMille;
    const calculated = sumCovered
      .dividedBy(1000)
      .times(rate)
      .times(years)
      .times(config.decreasingFactor);
    const contribution = money(Prisma.Decimal.max(calculated, config.minimumContribution));
    const wakalahFee = money(contribution.times(config.wakalahPercent).dividedBy(100));

    const referralReasons: string[] = [];
    if (amount > config.highRiskLimit) {
      referralReasons.push(
        `Financing amount B$${amount.toLocaleString('en-GB')} exceeds the high-risk limit of B$${config.highRiskLimit.toLocaleString('en-GB')} – refer to IIFT Sales team`,
      );
    }

    return {
      planCode: null,
      coverageType: null,
      termMonths: tenureMonths,
      sumCovered,
      contribution,
      wakalahFee,
      tabarru: money(contribution.minus(wakalahFee)),
      lines: [
        {
          label: `Takaful contribution (age ${age}, rate ${rate} per mille, ${years.toFixed(1)} years)`,
          amount: contribution.toFixed(2),
        },
      ],
      riskDetails: { ...values, ageNextBirthday: age },
      referralReasons,
      commissionRate: config.commissionRate,
    };
  }

  private read(raw: unknown): FinancingConfig {
    const reader = new ConfigReader(raw);
    const rateTable = reader
      .array('rateTable')
      .map((band) => ({
        maxAge: band.number('maxAge', { min: 1, max: 120 }),
        ratePerMille: band.number('ratePerMille', { min: 0 }),
      }))
      .sort((a, b) => a.maxAge - b.maxAge);
    const riskFields = readRiskFieldDefinitions((raw as { riskFields?: unknown }).riskFields);
    const missing = CORE_FIELDS.filter(
      (key) => !riskFields.some((field) => field.key === key && field.type === 'number'),
    );
    if (missing.length > 0) {
      throw new Error(`config.riskFields must define numeric fields: ${missing.join(', ')}`);
    }
    const config: FinancingConfig = {
      profitBasis: reader.string('profitBasis', ['FLAT', 'NONE']) as 'FLAT' | 'NONE',
      highRiskLimit: reader.number('highRiskLimit', { min: 0 }),
      minFinancing: reader.number('minFinancing', { min: 0 }),
      maxFinancing: reader.number('maxFinancing', { min: 1 }),
      minTenureMonths: reader.number('minTenureMonths', { min: 1 }),
      maxTenureMonths: reader.number('maxTenureMonths', { min: 1 }),
      minAge: reader.number('minAge', { min: 0 }),
      maxEntryAge: reader.number('maxEntryAge', { min: 1 }),
      maxAgeAtExpiry: reader.number('maxAgeAtExpiry', { min: 1 }),
      rateTable,
      decreasingFactor: reader.number('decreasingFactor', { min: 0.1, max: 1 }),
      wakalahPercent: reader.number('wakalahPercent', { min: 0, max: 100 }),
      minimumContribution: reader.number('minimumContribution', { min: 0 }),
      commissionRate: reader.number('commissionRate', { min: 0, max: 1 }),
      riskFields,
    };
    if (rateTable.at(-1)!.maxAge < config.maxEntryAge) {
      throw new Error('config.rateTable must cover every age up to maxEntryAge');
    }
    return config;
  }
}
