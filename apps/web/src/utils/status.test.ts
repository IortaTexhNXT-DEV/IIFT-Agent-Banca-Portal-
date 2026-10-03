import { statusColour, statusTone } from './status';

describe('statusColour', () => {
  it('uses one colour per semantic group', () => {
    expect(statusColour('ACTIVE')).toBe('green');
    expect(statusColour('PAID')).toBe('green');
    expect(statusColour('VERIFIED')).toBe('green');
    expect(statusColour('PENDING_APPROVAL')).toBe('orange');
    expect(statusColour('PENDING_VERIFICATION')).toBe('orange');
    expect(statusColour('UNPAID')).toBe('orange');
    expect(statusColour('SUBMITTED')).toBe('blue');
    expect(statusColour('RUNNING')).toBe('blue');
    expect(statusColour('REJECTED')).toBe('red');
    expect(statusColour('CANCELLED')).toBe('red');
    expect(statusColour('EXPIRED')).toBe('red');
    expect(statusColour('DRAFT')).toBe('default');
    expect(statusColour('CLOSED')).toBe('default');
  });

  it('exposes the semantic tone', () => {
    expect(statusTone('PENDING')).toBe('pending');
    expect(statusTone('FAILED')).toBe('negative');
  });

  it('falls back to the default colour for unknown or missing statuses', () => {
    expect(statusColour('SOMETHING_NEW')).toBe('default');
    expect(statusColour('active')).toBe('default');
    expect(statusColour(null)).toBe('default');
    expect(statusColour('')).toBe('default');
  });
});
