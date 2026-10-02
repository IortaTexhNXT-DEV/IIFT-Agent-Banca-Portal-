import { PlusOutlined } from '@ant-design/icons';
import { Button, Card } from 'antd';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { PolicySummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { filtersFromUrl, type PolicyFilterValues, PolicyFilters, policyQuery } from '../../components/sales/PolicyFilters';
import { PolicyTable } from '../../components/sales/PolicyTable';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

/** AP-21..23: the agent's (or agency's) quotations and policies with search and filters. */
export default function PolicyListPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [filters, setFilters] = useState<PolicyFilterValues>(() => filtersFromUrl(params));
  const policies = usePagedQuery<PolicySummary>('/portal/policies', policyQuery(filters));
  const agencyWide = can(P.portalAgencyWideView);

  return (
    <>
      <PageHeader
        title="Quotations & policies"
        subtitle={agencyWide ? 'All business written by your agency' : 'Business you have written'}
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Quotations & policies' }]}
        extra={
          can(P.portalPoliciesQuote) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/portal/quotations/new')}>
              New quotation
            </Button>
          )
        }
      />
      <PolicyFilters
        value={filters}
        onChange={(next) => {
          setFilters(next);
          policies.resetPage();
        }}
      />
      <Card className="content-card" styles={{ body: { padding: 0 } }}>
        <PolicyTable policies={policies.items} loading={policies.isFetching} pagination={policies.pagination} showAgent={agencyWide} />
      </Card>
    </>
  );
}
