import { Button } from 'antd';
import { useNavigate, useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { Payment } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { PaymentDetailView } from '../../components/sales/PaymentDetailView';
import '../../styles/sales.css';

/** BO: payment submitted by an agency or bank, with a shortcut to its verification request. */
export default function PaymentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const payment = useApiQuery<Payment>(`/backoffice/billing/payments/${id}`);

  return (
    <QueryState query={payment}>
      {(data) => {
        const pending = data.approvals?.find((approval) => approval.status === 'PENDING');
        return (
          <PaymentDetailView
            payment={data}
            actions={
              pending && (
                <Button type="primary" onClick={() => navigate(`/backoffice/approvals/${pending.id}`)}>
                  Open verification request {pending.requestNo}
                </Button>
              )
            }
          />
        );
      }}
    </QueryState>
  );
}
