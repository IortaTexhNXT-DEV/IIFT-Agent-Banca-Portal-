import {
  fileSize,
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  humanise,
  labelFromKey,
} from './format';

describe('formatMoney', () => {
  it('formats amounts in Brunei dollars with two decimals and thousands separators', () => {
    expect(formatMoney(1234.5)).toBe('B$ 1,234.50');
    expect(formatMoney('1000000')).toBe('B$ 1,000,000.00');
  });

  it('rounds to the nearest cent and keeps zero as an amount', () => {
    expect(formatMoney('99.999')).toBe('B$ 100.00');
    expect(formatMoney(0)).toBe('B$ 0.00');
  });

  it('shows a dash when there is no amount', () => {
    expect(formatMoney(null)).toBe('–');
    expect(formatMoney(undefined)).toBe('–');
    expect(formatMoney('')).toBe('–');
  });
});

describe('formatNumber', () => {
  it('groups thousands and shows a dash when there is no value', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber('42')).toBe('42');
    expect(formatNumber(null)).toBe('–');
    expect(formatNumber('')).toBe('–');
  });
});

describe('formatDate and formatDateTime', () => {
  it('formats a calendar date as day, short month and year', () => {
    expect(formatDate('2026-10-02')).toBe('02 Oct 2026');
  });

  it('formats a local timestamp with a 24-hour time', () => {
    expect(formatDateTime('2026-10-02T14:05:00')).toBe('02 Oct 2026, 14:05');
  });

  it('shows a dash for missing dates', () => {
    expect(formatDate(null)).toBe('–');
    expect(formatDate('')).toBe('–');
    expect(formatDateTime(undefined)).toBe('–');
  });
});

describe('humanise', () => {
  it('turns an enum code into sentence case', () => {
    expect(humanise('PENDING_APPROVAL')).toBe('Pending approval');
    expect(humanise('ACTIVE')).toBe('Active');
  });

  it('shows a dash for an empty value', () => {
    expect(humanise(null)).toBe('–');
    expect(humanise('')).toBe('–');
  });
});

describe('labelFromKey', () => {
  it('splits camel-case keys into a sentence-case label', () => {
    expect(labelFromKey('financingAmount')).toBe('Financing amount');
    expect(labelFromKey('sumCoveredPerLife')).toBe('Sum covered per life');
  });
});

describe('fileSize', () => {
  it('uses bytes, kilobytes or megabytes depending on size', () => {
    expect(fileSize(512)).toBe('512 B');
    expect(fileSize(2048)).toBe('2 KB');
    expect(fileSize(1024 * 1024 * 3.25)).toBe('3.3 MB');
  });
});
