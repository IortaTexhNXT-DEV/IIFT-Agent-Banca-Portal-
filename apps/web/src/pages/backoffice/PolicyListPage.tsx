import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { PolicySummary } from '../../api/types';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import {
  filtersFromUrl,
  type PolicyFilterValues,
  PolicyFilters,
  policyQuery,
} from '../../components/sales/PolicyFilters';
import { PolicyTable } from '../../components/sales/PolicyTable';
import '../../styles/sales.css';

/** BO: every quotation and policy across agencies and banks (read-only). */
export default function PolicyListPage() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<PolicyFilterValues>(() => filtersFromUrl(params));
  const policies = usePagedQuery<PolicySummary>('/backoffice/policies', policyQuery(filters));

  return (
    <>
      <PageHeader
        title="Policies"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Policies' }]}
      />
      <TableCard
        toolbar={
          <PolicyFilters
            value={filters}
            showAgency
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
          showAgent
          showAgency
        />
      </TableCard>
    </>
  );
}
