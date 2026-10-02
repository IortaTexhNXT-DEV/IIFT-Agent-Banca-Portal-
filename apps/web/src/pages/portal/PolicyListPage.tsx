import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { PolicySummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import {
  filtersFromUrl,
  type PolicyFilterValues,
  PolicyFilters,
  policyQuery,
} from '../../components/sales/PolicyFilters';
import { PolicyTable } from '../../components/sales/PolicyTable';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

/** AP-21..23: the agent's (or agency's) quotations and policies with search and filters. */
export default function PolicyListPage() {
  const [params] = useSearchParams();
  const { can } = useAuth();
  const [filters, setFilters] = useState<PolicyFilterValues>(() => filtersFromUrl(params));
  const policies = usePagedQuery<PolicySummary>('/portal/policies', policyQuery(filters));
  const agencyWide = can(P.portalAgencyWideView);

  return (
    <>
      <PageHeader
        title="Quotations & policies"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Quotations & policies' }]}
      />
      <TableCard
        toolbar={
          <PolicyFilters
            value={filters}
            onChange={(next) => {
              setFilters(next);
              policies.resetPage();
            }}
          />
        }
      >
        <PolicyTable
          policies={policies.items}
          loading={policies.isFetching}
          pagination={policies.pagination}
          showAgent={agencyWide}
        />
      </TableCard>
    </>
  );
}
