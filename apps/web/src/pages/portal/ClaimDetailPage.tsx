import { useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { Claim, RequiredDocument } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { QueryState } from '../../components/QueryState';
import { ClaimDetailView } from '../../components/sales/ClaimDetailView';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

const CLAIM_DOCUMENTS: RequiredDocument[] = [
  { docType: 'CLAIM_FORM', label: 'Claim form', mandatory: false },
  { docType: 'CLAIM_SUPPORT', label: 'Claim supporting document', mandatory: false },
];

/** AP-43: claim notification with its status and supporting documents. */
export default function ClaimDetailPage() {
  const { id } = useParams();
  const { can } = useAuth();
  const claim = useApiQuery<Claim>(`/portal/claims/${id}`);
  return (
    <QueryState query={claim}>
      {(data) => <ClaimDetailView claim={data} uploadTypes={can(P.portalClaimsSubmit) && data.status !== 'CLOSED' ? CLAIM_DOCUMENTS : undefined} />}
    </QueryState>
  );
}
