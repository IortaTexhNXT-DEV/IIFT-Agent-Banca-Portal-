import { PageHeader } from '../../components/PageHeader';
import { ClaimList } from '../../components/sales/ClaimList';
import '../../styles/sales.css';

/** BO: claim notifications from all agencies and banks, tracked by the Claims team. */
export default function ClaimListPage() {
  return (
    <>
      <PageHeader
        title="Claims"
        subtitle="Claim notifications from agencies and banks"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Claims' }]}
      />
      <ClaimList path="/backoffice/claims" />
    </>
  );
}
