import { describe, expect, it } from 'vitest';
import { describePlan } from './plan-label.js';

const config = {
  plans: [{ code: 'B', name: 'Plan B' }],
  coverageTypes: [{ code: 'FAMILY', name: 'Family' }],
};

describe('describePlan', () => {
  it('uses the configured names', () => {
    expect(describePlan(config, 'B', 'FAMILY')).toBe('Plan B / Family');
  });

  it('falls back to the code for a retired plan', () => {
    expect(describePlan(config, 'Z', null)).toBe('Z');
  });

  it('returns null when the product has no plans', () => {
    expect(describePlan({ ageBands: [] }, null, null)).toBeNull();
  });
});
