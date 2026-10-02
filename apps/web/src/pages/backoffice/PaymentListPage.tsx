import { PageHeader } from '../../components/PageHeader';
import { PaymentList } from '../../components/sales/PaymentList';

/** BO: payments submitted by agencies and banks, verified by Finance through approvals. */
export default function PaymentListPage() {
  return (
    <>
      <PageHeader title="Payments" subtitle="Contribution payments submitted by agencies and banks" breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Payments' }]} />
      <PaymentList path="/backoffice/billing/payments" showAgency />
    </>
  );
}
