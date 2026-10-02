import { BACKOFFICE_MENU, PORTAL_MENU, selectedMenuKeys } from './menus';

describe('selectedMenuKeys', () => {
  it('highlights the dashboard only on the module root', () => {
    expect(selectedMenuKeys(PORTAL_MENU, '/portal')).toEqual(['/portal']);
    expect(selectedMenuKeys(BACKOFFICE_MENU, '/backoffice')).toEqual(['/backoffice']);
  });

  it('highlights nothing on pages without a menu entry', () => {
    expect(selectedMenuKeys(PORTAL_MENU, '/portal/profile')).toEqual([]);
    expect(selectedMenuKeys(PORTAL_MENU, '/portal/notifications')).toEqual([]);
    expect(selectedMenuKeys(BACKOFFICE_MENU, '/backoffice/notifications')).toEqual([]);
  });

  it('highlights the entry whose path is a parent of the current page', () => {
    expect(selectedMenuKeys(PORTAL_MENU, '/portal/billing/payments/pay-1')).toEqual([
      '/portal/billing',
    ]);
    expect(selectedMenuKeys(BACKOFFICE_MENU, '/backoffice/agents/a1')).toEqual([
      '/backoffice/agents',
    ]);
  });

  it('prefers the longest matching entry', () => {
    const menu = [
      {
        entries: [
          { path: '/portal/claims', label: 'Claims', icon: null },
          { path: '/portal/claims/new', label: 'New claim', icon: null },
        ],
      },
    ];
    expect(selectedMenuKeys(menu, '/portal/claims/new')).toEqual(['/portal/claims/new']);
    expect(selectedMenuKeys(menu, '/portal/claims/c1')).toEqual(['/portal/claims']);
  });

  it('does not match entries that merely share a prefix', () => {
    expect(selectedMenuKeys(BACKOFFICE_MENU, '/backoffice/agentsx')).toEqual([]);
  });

  it('ignores a trailing slash', () => {
    expect(selectedMenuKeys(PORTAL_MENU, '/portal/')).toEqual(['/portal']);
    expect(selectedMenuKeys(PORTAL_MENU, '/portal/claims/')).toEqual(['/portal/claims']);
  });
});
