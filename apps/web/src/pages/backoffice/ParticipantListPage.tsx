import { PageHeader } from '../../components/PageHeader';
import { ParticipantList } from '../../components/sales/ParticipantList';

/** BO: the single participant register across all agencies and banks. */
export default function ParticipantListPage() {
  return (
    <>
      <PageHeader title="Participants" subtitle="All registered participants" breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Participants' }]} />
      <ParticipantList path="/backoffice/participants" />
    </>
  );
}
