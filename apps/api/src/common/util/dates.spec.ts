import {
  addMonths,
  ageNextBirthday,
  businessDayRange,
  businessToday,
  daysBetween,
} from './dates.js';

const date = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('date helpers', () => {
  it('computes age at next birthday', () => {
    expect(ageNextBirthday(date('1990-10-01'), date('2026-10-01'))).toBe(37);
    expect(ageNextBirthday(date('1990-10-02'), date('2026-10-01'))).toBe(36);
  });

  it('uses the Brunei calendar day (UTC+8) as the business date', () => {
    expect(businessToday(new Date('2026-10-01T16:30:00Z')).toISOString()).toBe(
      '2026-10-02T00:00:00.000Z',
    );
    expect(businessToday(new Date('2026-10-01T15:59:00Z')).toISOString()).toBe(
      '2026-10-01T00:00:00.000Z',
    );
  });

  it('returns the UTC instants bounding a Brunei business day', () => {
    const { from, to } = businessDayRange(date('2026-10-01'));
    expect(from.toISOString()).toBe('2026-09-30T16:00:00.000Z');
    expect(to.toISOString()).toBe('2026-10-01T16:00:00.000Z');
  });

  it('adds months and counts days', () => {
    expect(addMonths(date('2026-01-15'), 12).toISOString().slice(0, 10)).toBe('2027-01-15');
    expect(daysBetween(date('2026-10-01'), date('2026-10-08'))).toBe(7);
  });
});
