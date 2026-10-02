import { useAuth } from '../../auth/AuthContext';

/** Routes of the sales records within the signed-in user's module (portal or back-office). */
export function useSalesLinks() {
  const { user } = useAuth();
  const backoffice = user?.audience === 'BACKOFFICE';
  const base = backoffice ? '/backoffice' : '/portal';
  return {
    backoffice,
    policy: (id: string) => `${base}/policies/${id}`,
    participant: (id: string) => `${base}/participants/${id}`,
    claim: (id: string) => `${base}/claims/${id}`,
    payment: (id: string) => (backoffice ? `/backoffice/payments/${id}` : `/portal/billing/payments/${id}`),
  };
}
