import { UserAddOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { ParticipantList } from '../../components/sales/ParticipantList';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

/** AP-11/12: participants registered by, or insured through, the agency. */
export default function ParticipantListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Participants"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Participants' }]}
        extra={
          can(P.portalParticipantsManage) && (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => navigate('/portal/participants/new')}
            >
              Register participant
            </Button>
          )
        }
      />
      <ParticipantList path="/portal/participants" />
    </>
  );
}
