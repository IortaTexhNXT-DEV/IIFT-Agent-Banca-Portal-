import { csvCell } from './report-exporter.js';
import { nextRun, periodToFilters } from './reports.service.js';

describe('report export', () => {
  it('quotes CSV cells and neutralises spreadsheet formulas', () => {
    expect(csvCell('Plan "A"')).toBe('"Plan ""A"""');
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('@SUM(A1)')).toBe('"\'@SUM(A1)"');
    expect(csvCell('-12.50')).toBe('"-12.50"');
  });
});

describe('report scheduling', () => {
  it('runs daily reports at 07:00 Brunei time (23:00 UTC)', () => {
    expect(nextRun('DAILY', new Date('2026-10-01T10:00:00Z')).toISOString()).toBe(
      '2026-10-01T23:00:00.000Z',
    );
    expect(nextRun('DAILY', new Date('2026-10-01T23:30:00Z')).toISOString()).toBe(
      '2026-10-02T23:00:00.000Z',
    );
  });

  it('runs weekly reports on Monday and monthly reports on the 1st (local time)', () => {
    // Monday 5 Oct 2026 07:00 Brunei = Sunday 4 Oct 23:00 UTC
    expect(nextRun('WEEKLY', new Date('2026-10-01T00:00:00Z')).toISOString()).toBe(
      '2026-10-04T23:00:00.000Z',
    );
    // 1 Nov 2026 07:00 Brunei = 31 Oct 23:00 UTC
    expect(nextRun('MONTHLY', new Date('2026-10-02T00:00:00Z')).toISOString()).toBe(
      '2026-10-31T23:00:00.000Z',
    );
  });

  it('resolves relative periods to date ranges', () => {
    const today = new Date('2026-10-15T00:00:00Z');
    expect(periodToFilters('PREVIOUS_DAY', today)).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
    });
    expect(periodToFilters('PREVIOUS_MONTH', today)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(periodToFilters('MONTH_TO_DATE', today)).toEqual({
      from: '2026-10-01',
      to: '2026-10-15',
    });
  });
});
