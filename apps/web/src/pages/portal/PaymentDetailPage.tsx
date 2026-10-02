import { useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { Payment } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { PaymentDetailView } from '../../components/sales/PaymentDetailView';

/** AP-38..41: a submitted payment with its allocations, proof, e-Receipts and verification. */
export default function PaymentDetailPage() {
  const { id } = useParams();
  const payment = useApiQuery<Payment>(`/portal/billing/payments/${id}`);
  return <QueryState query={payment}>{(data) => <PaymentDetailView payment={data} />}</QueryState>;
}
