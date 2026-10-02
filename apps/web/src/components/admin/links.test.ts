import { notificationPath, recordPath } from './links';

describe('recordPath', () => {
  it('links to the record page regardless of the entity type spelling', () => {
    expect(recordPath('BACKOFFICE', 'Policy', 'p1')).toBe('/backoffice/policies/p1');
    expect(recordPath('BACKOFFICE', 'POLICY', 'p1')).toBe('/backoffice/policies/p1');
  });

  it('uses the portal routes for portal users', () => {
    expect(recordPath('PORTAL', 'Payment', 'pay1')).toBe('/portal/billing/payments/pay1');
    expect(recordPath('PORTAL', 'Agent', 'a1')).toBe('/portal/team/a1');
  });

  it('returns null when the audience has no page for the record or the id is missing', () => {
    expect(recordPath('PORTAL', 'Agency', 'ag1')).toBeNull();
    expect(recordPath('BACKOFFICE', 'Unknown', 'x1')).toBeNull();
    expect(recordPath('BACKOFFICE', 'Policy', null)).toBeNull();
    expect(recordPath('BACKOFFICE', null, 'p1')).toBeNull();
  });
});

describe('notificationPath', () => {
  it('keeps links that already point into a module', () => {
    expect(notificationPath('PORTAL', '/backoffice/approvals/1')).toBe('/backoffice/approvals/1');
    expect(notificationPath('BACKOFFICE', '/portal/policies/2')).toBe('/portal/policies/2');
  });

  it('prefixes audience-neutral links with the user module', () => {
    expect(notificationPath('PORTAL', '/issues/7')).toBe('/portal/issues/7');
    expect(notificationPath('BACKOFFICE', 'issues/7')).toBe('/backoffice/issues/7');
  });
});
