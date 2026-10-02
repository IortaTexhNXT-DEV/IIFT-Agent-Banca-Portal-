import { PRODUCTS } from '../../../../prisma/reference-data/products.js';
import { FixedPlanRatingEngine } from './fixed-plan.engine.js';
import type { RatingContext } from './rating.types.js';

const engine = new FixedPlanRatingEngine();
const config = (code: string) => PRODUCTS.find((p) => p.code === code)!.config;

const adult: RatingContext = {
  participantType: 'INDIVIDUAL',
  dateOfBirth: new Date('1988-04-20T00:00:00Z'),
  nationality: 'BRUNEI',
  occupationClass: 1,
  startDate: new Date('2026-10-01T00:00:00Z'),
};

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
}

describe('FixedPlanRatingEngine', () => {
  it('prices Professional Plan B with the optional additional cover (FFR03)', () => {
    const quote = engine.quote(
      config('PRO'),
      { planCode: 'B', additionalCover: true, riskDetails: {} },
      adult,
    );
    expect(quote.sumCovered.toFixed(0)).toBe('30000');
    expect(quote.contribution.toFixed(2)).toBe('255.00');
    expect(quote.lines.map((line) => line.label)).toEqual([
      'Plan B – 1 year(s)',
      'Additional cover – Plan B',
    ]);
  });

  it('accepts only Occupational Class I for the Professional plan', () => {
    expect(
      codeOf(() =>
        engine.quote(
          config('PRO'),
          { planCode: 'A', riskDetails: {} },
          { ...adult, occupationClass: 2 },
        ),
      ),
    ).toBe('NOT_ELIGIBLE');
  });

  it('applies the Wider (Child) loading for Khairat (FFR04)', () => {
    const quote = engine.quote(
      config('KHR'),
      { planCode: 'B', coverageType: 'WIDER', riskDetails: {} },
      adult,
    );
    expect(quote.contribution.toFixed(2)).toBe('120.00');
  });

  it('requires a coverage type when the product defines them', () => {
    expect(
      codeOf(() => engine.quote(config('KHR'), { planCode: 'B', riskDetails: {} }, adult)),
    ).toBe('NOT_ELIGIBLE');
  });

  it('offers 1- and 2-year cover for Personal Home Assistant (FFR02)', () => {
    const risk = {
      helperName: 'A',
      helperPassportNo: 'P1',
      helperNationality: 'Philippines',
      labourLicenceNo: 'LL1',
    };
    expect(
      engine
        .quote(config('PHA'), { planCode: 'STANDARD', termMonths: 24, riskDetails: risk }, adult)
        .contribution.toFixed(2),
    ).toBe('220.00');
    expect(
      codeOf(() =>
        engine.quote(
          config('PHA'),
          { planCode: 'STANDARD', termMonths: 36, riskDetails: risk },
          adult,
        ),
      ),
    ).toBe('NOT_ELIGIBLE');
  });

  describe('Overseas Student Assist eligibility (FFR05)', () => {
    const student = {
      registeredStudent: true,
      institutionName: 'Uni',
      countryOfStudy: 'UK',
      studentIdNo: 'S1',
      courseEndDate: '2029-06-30',
    };

    it('accepts a registered Brunei citizen student', () => {
      expect(
        engine
          .quote(config('OSA'), { planCode: 'TERTIARY', riskDetails: student }, adult)
          .contribution.toFixed(2),
      ).toBe('380.00');
    });

    it('rejects a participant who is not a Brunei citizen', () => {
      expect(
        codeOf(() =>
          engine.quote(
            config('OSA'),
            { planCode: 'BASIC', riskDetails: student },
            { ...adult, nationality: 'MALAYSIA' },
          ),
        ),
      ).toBe('NOT_ELIGIBLE');
    });

    it('requires confirmation of student registration', () => {
      expect(
        codeOf(() =>
          engine.quote(
            config('OSA'),
            { planCode: 'BASIC', riskDetails: { ...student, registeredStudent: false } },
            adult,
          ),
        ),
      ).toBe('NOT_ELIGIBLE');
    });

    it('rejects participants older than 65 next birthday', () => {
      expect(
        codeOf(() =>
          engine.quote(
            config('OSA'),
            { planCode: 'BASIC', riskDetails: student },
            { ...adult, dateOfBirth: new Date('1960-01-01T00:00:00Z') },
          ),
        ),
      ).toBe('NOT_ELIGIBLE');
    });
  });

  it('drops risk details that the product does not define', () => {
    const quote = engine.quote(
      config('PRO'),
      { planCode: 'A', riskDetails: { injected: '<script>' } },
      adult,
    );
    expect(quote.riskDetails).not.toHaveProperty('injected');
  });

  it('validates every catalogue product configuration', () => {
    for (const product of PRODUCTS.filter((p) => p.ratingEngine === 'FIXED_PLAN')) {
      expect(() => engine.validateConfig(product.config)).not.toThrow();
    }
  });
});
