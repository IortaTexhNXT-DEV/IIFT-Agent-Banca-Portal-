import {
  formatTerm,
  NOMINEE_ROLE_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  policyReference,
} from './options';

describe('status and role options', () => {
  it('label each code in sentence case', () => {
    expect(PAYMENT_STATUS_OPTIONS).toEqual([
      { value: 'PENDING_VERIFICATION', label: 'Pending verification' },
      { value: 'VERIFIED', label: 'Verified' },
      { value: 'REJECTED', label: 'Rejected' },
    ]);
    expect(NOMINEE_ROLE_OPTIONS.map((option) => option.label)).toEqual([
      'Nominee',
      'Beneficiary',
      'Executor',
    ]);
  });
});

describe('policyReference', () => {
  it('uses the policy number once the policy is issued', () => {
    expect(policyReference({ policyNo: 'P-2026-0001', quotationNo: 'Q-2026-0042' })).toBe(
      'P-2026-0001',
    );
  });

  it('falls back to the quotation number before issuance', () => {
    expect(policyReference({ policyNo: null, quotationNo: 'Q-2026-0042' })).toBe('Q-2026-0042');
  });
});

describe('formatTerm', () => {
  it('shows whole years in years and anything else in months', () => {
    expect(formatTerm(12)).toBe('1 year');
    expect(formatTerm(36)).toBe('3 years');
    expect(formatTerm(18)).toBe('18 months');
  });
});
