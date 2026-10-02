import { screen, waitFor } from '@testing-library/react';
import { api, ApiError } from '../../api/client';
import { renderWithProviders } from '../../test-utils';
import { PaymentList, paymentFiltersFromUrl } from './PaymentList';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

describe('paymentFiltersFromUrl', () => {
  it('reads a known payment status', () => {
    expect(paymentFiltersFromUrl(new URLSearchParams('status=PENDING_VERIFICATION'))).toEqual({
      status: 'PENDING_VERIFICATION',
    });
  });

  it('ignores missing or unknown statuses', () => {
    expect(paymentFiltersFromUrl(new URLSearchParams())).toEqual({ status: undefined });
    expect(paymentFiltersFromUrl(new URLSearchParams('status=PAID'))).toEqual({
      status: undefined,
    });
  });
});

describe('PaymentList', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (path: string) => {
      if (path === '/auth/me') throw new ApiError(401, 'UNAUTHENTICATED', 'Not signed in');
      if (path === '/backoffice/agencies/options') return [];
      return { items: [], total: 0, page: 1, pageSize: 20 };
    });
  });

  afterEach(() => {
    vi.mocked(api.get).mockReset();
  });

  it('starts filtered by the status in the URL', async () => {
    renderWithProviders(<PaymentList path="/backoffice/billing/payments" showAgency />, {
      route: '/backoffice/payments?status=PENDING_VERIFICATION',
      withAuth: true,
    });

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith(
        '/backoffice/billing/payments',
        expect.objectContaining({ status: 'PENDING_VERIFICATION', page: 1 }),
      ),
    );
    expect(screen.getByTitle('Pending verification')).toBeInTheDocument();
  });
});
