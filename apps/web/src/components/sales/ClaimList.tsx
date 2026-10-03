import { Input, Select } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { Claim, ClaimStatus } from '../../api/types';
import { DataTable, dateColumn, moneyColumn, statusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { TableCard } from '../TableCard';
import { CLAIM_STATUS_OPTIONS } from './options';
import { useCodes } from './useCodes';
import { useSalesLinks } from './useSalesLinks';

type Filters = {
  search?: string;
  status?: ClaimStatus;
};

/** AP-43: claim notifications with their processing status (portal: own scope; back-office: all). */
export function ClaimList({ path }: { path: '/portal/claims' | '/backoffice/claims' }) {
  const links = useSalesLinks();
  const navigate = useNavigate();
  const claimTypes = useCodes('CLAIM_TYPE');
  const [filters, setFilters] = useState<Filters>({});
  const claims = usePagedQuery<Claim>(path, filters);
  const set = (patch: Partial<Filters>) => {
    setFilters({ ...filters, ...patch });
    claims.resetPage();
  };

  return (
    <TableCard
      toolbar={
        <>
          <Input.Search
            placeholder="Claim no., policy no. or participant"
            aria-label="Search claims"
            allowClear
            onSearch={(search) => set({ search: search.trim() || undefined })}
            className="filter-search"
          />
          <Select
            placeholder="Status"
            aria-label="Status"
            allowClear
            options={CLAIM_STATUS_OPTIONS}
            value={filters.status}
            onChange={(status) => set({ status })}
            className="filter-select"
          />
        </>
      }
    >
      <DataTable<Claim>
        rowKey="id"
        loading={claims.isFetching}
        dataSource={claims.items}
        pagination={claims.pagination}
        scroll={{}}
        onRowClick={(claim) => navigate(links.claim(claim.id))}
        locale={{ emptyText: <EmptyState label="No claims" /> }}
        columns={[
          {
            title: 'Claim no.',
            dataIndex: 'claimNo',
            width: 130,
            render: (claimNo: string, claim) => <Link to={links.claim(claim.id)}>{claimNo}</Link>,
          },
          {
            title: 'Policy no.',
            key: 'policy',
            width: 130,
            render: (_, claim) => (
              <Link to={links.policy(claim.policy.id)}>{claim.policy.policyNo}</Link>
            ),
          },
          textColumn('Participant', ['policy', 'participant', 'fullName']),
          ...(links.backoffice
            ? [textColumn<Claim>('Agency / bank', ['policy', 'agency', 'name'], 150)]
            : [textColumn<Claim>('Product', ['policy', 'product', 'name'], 160)]),
          {
            title: 'Type',
            dataIndex: 'claimType',
            width: 120,
            ellipsis: true,
            render: claimTypes.label,
          },
          dateColumn('Event date', 'eventDate', 110),
          moneyColumn('Claimed', 'claimedAmount', 110),
          statusColumn('Status', 'status', 125),
          dateColumn('Notified', 'createdAt', 120),
        ]}
      />
    </TableCard>
  );
}
