import { PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useNavigate } from 'react-router';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { ClaimList } from '../../components/sales/ClaimList';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

/** AP-43: claims notified by the agent or agency. */
export default function ClaimListPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  return (
    <>
      <PageHeader
        title="Claims"
        subtitle="Claim notifications forwarded to IIFT"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Claims' }]}
        extra={
          can(P.portalClaimsSubmit) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/portal/claims/new')}>
              Notify claim
            </Button>
          )
        }
      />
      <ClaimList path="/portal/claims" />
    </>
  );
}
