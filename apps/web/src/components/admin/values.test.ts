import { formatValue, isHiddenKey, isRecord, keyLabel } from './values';

describe('isHiddenKey', () => {
  it('hides optimistic-lock versions and encrypted or hashed values only', () => {
    expect(isHiddenKey('version')).toBe(true);
    expect(isHiddenKey('idNumberEnc')).toBe(true);
    expect(isHiddenKey('idNumberHash')).toBe(true);
    expect(isHiddenKey('fullName')).toBe(false);
    expect(isHiddenKey('versionNote')).toBe(false);
  });
});

describe('keyLabel', () => {
  it('uses curated labels where needed and sentence case otherwise', () => {
    expect(keyLabel('policyNo')).toBe('Policy no.');
    expect(keyLabel('amlStatus')).toBe('AML status');
    expect(keyLabel('referralReasons')).toBe('Referral reasons');
    expect(keyLabel('reason_code')).toBe('Reason code');
  });
});

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('text')).toBe(false);
  });
});

describe('formatValue', () => {
  it('shows a dash for empty values and Yes/No for booleans', () => {
    expect(formatValue('remarks', null)).toBe('–');
    expect(formatValue('remarks', '')).toBe('–');
    expect(formatValue('smoker', true)).toBe('Yes');
    expect(formatValue('smoker', false)).toBe('No');
  });

  it('formats numeric values of amount-like keys as money', () => {
    expect(formatValue('totalAmount', '2500')).toBe('B$ 2,500.00');
    expect(formatValue('sumCovered', 100000)).toBe('B$ 100,000.00');
    expect(formatValue('creditLimit', 'n/a')).toBe('n/a');
  });

  it('formats ISO dates and timestamps', () => {
    expect(formatValue('startDate', '2026-10-02')).toBe('02 Oct 2026');
    expect(formatValue('effectiveAt', '2026-10-02T00:00:00.000Z')).toBe('02 Oct 2026');
    expect(formatValue('submittedAt', '2026-10-02T14:05:00')).toBe('02 Oct 2026, 14:05');
  });

  it('humanises enum codes that contain underscores or sit under an enum-like key', () => {
    expect(formatValue('anything', 'PENDING_APPROVAL')).toBe('Pending approval');
    expect(formatValue('status', 'ACTIVE')).toBe('Active');
    expect(formatValue('agentCode', 'AG001')).toBe('AG001');
  });

  it('serialises nested values as JSON', () => {
    expect(formatValue('reasons', ['A', 'B'])).toBe('["A","B"]');
  });
});
