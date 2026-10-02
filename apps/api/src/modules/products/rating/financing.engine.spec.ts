import { PRODUCTS } from '../../../../prisma/reference-data/products.js';
import { FinancingRatingEngine } from './financing.engine.js';
import type { RatingContext } from './rating.types.js';

const engine = new FinancingRatingEngine();
const hirePurchase = PRODUCTS.find((p) => p.code === 'FTP-HP')!.config;
const property = PRODUCTS.find((p) => p.code === 'PFT')!.config;

const context = (dateOfBirth: string): RatingContext => ({
  participantType: 'INDIVIDUAL',
  dateOfBirth: new Date(`${dateOfBirth}T00:00:00Z`),
  nationality: 'BRUNEI',
  occupationClass: 1,
  startDate: new Date('2026-10-01T00:00:00Z'),
});

const hpRisk = (financingAmount: number, tenureMonths = 60) => ({
  riskDetails: {
    financingAmount,
    tenureMonths,
    profitRatePercent: 3.5,
    financierName: 'Bank A',
    financingReference: 'HP/1',
  },
});

describe('FinancingRatingEngine', () => {
  it('calculates a decreasing-term contribution on the flat-rate financing total', () => {
    // Age next birthday 37 -> 3.2 per mille; sum covered = 50,000 x (1 + 3.5% x 5) = 58,750
    const quote = engine.quote(hirePurchase, hpRisk(50_000), context('1990-03-15'));
    expect(quote.sumCovered.toFixed(2)).toBe('58750.00');
    // 58,750 / 1000 x 3.2 x 5 years x 0.55 = 517.00
    expect(quote.contribution.toFixed(2)).toBe('517.00');
    expect(quote.wakalahFee.plus(quote.tabarru).toFixed(2)).toBe('517.00');
    expect(quote.referralReasons).toEqual([]);
  });

  it('refers financing above the B$150,000 high-risk limit to IIFT Sales', () => {
    const quote = engine.quote(hirePurchase, hpRisk(150_000.01), context('1990-03-15'));
    expect(quote.referralReasons).toHaveLength(1);
    expect(quote.referralReasons[0]).toContain('high-risk limit of B$150,000');
  });

  it('does not refer financing exactly at the high-risk limit', () => {
    expect(
      engine.quote(hirePurchase, hpRisk(150_000), context('1990-03-15')).referralReasons,
    ).toEqual([]);
  });

  it('rejects cover that would run past the maximum age at expiry', () => {
    expect(() =>
      engine.quote(
        property,
        {
          riskDetails: {
            financingAmount: 300_000,
            tenureMonths: 300,
            profitRatePercent: 3,
            financierName: 'Bank A',
            financingReference: 'HF/1',
            propertyAddress: 'Lot 1',
          },
        },
        context('1975-01-01'),
      ),
    ).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: 'NOT_ELIGIBLE' }) }),
    );
  });

  it('applies no profit loading when the product uses NONE as profit basis', () => {
    const quote = engine.quote(
      property,
      {
        riskDetails: {
          financingAmount: 200_000,
          tenureMonths: 240,
          profitRatePercent: 3,
          financierName: 'Bank A',
          financingReference: 'HF/1',
          propertyAddress: 'Lot 1',
        },
      },
      context('1995-06-01'),
    );
    expect(quote.sumCovered.toFixed(2)).toBe('200000.00');
  });

  it('lists every missing risk field at once', () => {
    try {
      engine.quote(hirePurchase, { riskDetails: {} }, context('1990-03-15'));
      expect.unreachable();
    } catch (error) {
      const details = (error as { response: { details: string[] } }).response.details;
      expect(details.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('validates its configuration', () => {
    expect(() => engine.validateConfig({ ...hirePurchase, rateTable: [] })).toThrow(/rateTable/);
    expect(() => engine.validateConfig({ ...hirePurchase, riskFields: [] })).toThrow(
      /financingAmount/,
    );
  });
});
