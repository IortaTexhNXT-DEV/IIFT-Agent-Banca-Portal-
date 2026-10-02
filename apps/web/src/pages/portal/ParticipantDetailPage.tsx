import { Button } from 'antd';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { ParticipantDetail, ParticipantMatch } from '../../api/sales-types';
import { useAuth } from '../../auth/AuthContext';
import { QueryState } from '../../components/QueryState';
import { ParticipantDetailView } from '../../components/sales/ParticipantDetailView';
import { ParticipantUpdateModal } from '../../components/sales/ParticipantUpdateModal';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

/** AP-12/14/15: participant profile with policies and documents; changes go through approval. */
export default function ParticipantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [updating, setUpdating] = useState(false);
  const participant = useApiQuery<ParticipantDetail>(`/portal/participants/${id}`);
  const canManage = can(P.portalParticipantsManage);

  return (
    <QueryState query={participant}>
      {(data) => {
        const match: ParticipantMatch = {
          id: data.id,
          participantNo: data.participantNo,
          fullName: data.fullName,
          idNumberMasked: data.idNumberMasked,
          amlStatus: data.amlStatus,
        };
        return (
          <>
            <ParticipantDetailView
              participant={data}
              canUpload={canManage}
              actions={
                <>
                  {canManage && <Button onClick={() => setUpdating(true)}>Request update</Button>}
                  {can(P.portalPoliciesQuote) && data.amlStatus !== 'REJECTED' && (
                    <Button
                      type="primary"
                      onClick={() =>
                        navigate('/portal/quotations/new', { state: { participant: match } })
                      }
                    >
                      New quotation
                    </Button>
                  )}
                </>
              }
            />
            {updating && (
              <ParticipantUpdateModal participant={data} onClose={() => setUpdating(false)} />
            )}
          </>
        );
      }}
    </QueryState>
  );
}
