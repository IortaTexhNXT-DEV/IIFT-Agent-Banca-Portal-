import { APPROVE_PERMISSIONS, P } from './permissions';

describe('permission codes', () => {
  it('are unique', () => {
    const codes = Object.values(P);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('use the portal or back-office prefix matching their key', () => {
    for (const [key, code] of Object.entries(P)) {
      const prefix = key.startsWith('portal') ? 'portal.' : 'bo.';
      expect(code.startsWith(prefix), `${key} -> ${code}`).toBe(true);
    }
  });

  it('group every approval permission and nothing else', () => {
    const approvals = Object.values(P).filter((code) => code.startsWith('bo.approve.'));
    expect([...APPROVE_PERMISSIONS].sort()).toEqual([...approvals].sort());
  });
});
