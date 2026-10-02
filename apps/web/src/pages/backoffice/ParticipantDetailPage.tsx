import { useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { ParticipantDetail } from '../../api/sales-types';
import { QueryState } from '../../components/QueryState';
import { ParticipantDetailView } from '../../components/sales/ParticipantDetailView';
import '../../styles/sales.css';

/** BO: participant profile with policies, documents, update requests and AML screening history. */
export default function ParticipantDetailPage() {
  const { id } = useParams();
  const participant = useApiQuery<ParticipantDetail>(`/backoffice/participants/${id}`);
  return (
    <QueryState query={participant}>
      {(data) => <ParticipantDetailView participant={data} />}
    </QueryState>
  );
}
