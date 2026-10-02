import { screen, waitFor } from '@testing-library/react';
import { api } from '../api/client';
import { renderWithProviders, sessionUser } from '../test-utils';
import { P } from '../utils/permissions';
import { RequirePermission } from './RequirePermission';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

function signInAs(permissions: string[]) {
  vi.mocked(api.get).mockResolvedValue({
    user: sessionUser({ permissions }),
    csrfToken: 'csrf',
  });
}

function renderPage() {
  return renderWithProviders(
    <RequirePermission permission={P.portalPoliciesView}>
      <p>Policy list</p>
    </RequirePermission>,
    { withAuth: true },
  );
}

describe('RequirePermission', () => {
  afterEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('renders the page when the user holds the permission', async () => {
    signInAs([P.portalDashboard, P.portalPoliciesView]);

    renderPage();

    expect(await screen.findByText('Policy list')).toBeInTheDocument();
    expect(screen.queryByText('Not authorised')).not.toBeInTheDocument();
  });

  it('shows the not-authorised page when the permission is missing', async () => {
    signInAs([P.portalDashboard]);

    const { queryClient } = renderPage();

    await waitFor(() => expect(queryClient.getQueryState(['auth', 'me'])?.status).toBe('success'));
    expect(screen.getByText('Not authorised')).toBeInTheDocument();
    expect(screen.queryByText('Policy list')).not.toBeInTheDocument();
  });
});
