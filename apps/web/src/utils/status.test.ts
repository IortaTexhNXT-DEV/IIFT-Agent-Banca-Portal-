import { statusColour } from './status';

describe('statusColour', () => {
  it('maps statuses to the tag colour of their stage', () => {
    expect(statusColour('ACTIVE')).toBe('green');
    expect(statusColour('PENDING_APPROVAL')).toBe('gold');
    expect(statusColour('PENDING_VERIFICATION')).toBe('orange');
    expect(statusColour('SUBMITTED')).toBe('blue');
    expect(statusColour('UNPAID')).toBe('volcano');
    expect(statusColour('REJECTED')).toBe('red');
    expect(statusColour('RUNNING')).toBe('processing');
    expect(statusColour('CANCELLED')).toBe('default');
  });

  it('falls back to the default colour for unknown or missing statuses', () => {
    expect(statusColour('SOMETHING_NEW')).toBe('default');
    expect(statusColour('active')).toBe('default');
    expect(statusColour(null)).toBe('default');
    expect(statusColour('')).toBe('default');
  });
});
