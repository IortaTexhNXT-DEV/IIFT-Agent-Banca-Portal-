import { Card, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { Claim, ClaimStatus, Money as MoneyValue } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/format';
import { FilterBar } from '../FilterBar';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
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
  const claimTypes = useCodes('CLAIM_TYPE');
  const [filters, setFilters] = useState<Filters>({});
  const claims = usePagedQuery<Claim>(path, filters);
  const set = (patch: Partial<Filters>) => {
    setFilters({ ...filters, ...patch });
    claims.resetPage();
  };

  return (
    <>
      <FilterBar>
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
      </FilterBar>
      <Card className="content-card" styles={{ body: { padding: 0 } }}>
        <Table<Claim>
          size="middle"
          rowKey="id"
          loading={claims.isFetching}
          dataSource={claims.items}
          pagination={claims.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No claims notified' }}
          columns={[
            {
              title: 'Claim no.',
              dataIndex: 'claimNo',
              render: (claimNo: string, claim) => <Link to={links.claim(claim.id)}>{claimNo}</Link>,
            },
            {
              title: 'Policy no.',
              key: 'policy',
              render: (_, claim) => (
                <Link to={links.policy(claim.policy.id)}>{claim.policy.policyNo}</Link>
              ),
            },
            { title: 'Participant', dataIndex: ['policy', 'participant', 'fullName'] },
            { title: 'Product', dataIndex: ['policy', 'product', 'name'] },
            ...(links.backoffice
              ? [{ title: 'Agency / bank', dataIndex: ['policy', 'agency', 'name'] }]
              : []),
            { title: 'Type', dataIndex: 'claimType', render: claimTypes.label },
            { title: 'Event date', dataIndex: 'eventDate', render: formatDate },
            {
              title: 'Claimed',
              dataIndex: 'claimedAmount',
              align: 'right',
              render: (value: MoneyValue | null) => <Money value={value} />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status: string) => <StatusTag status={status} />,
            },
            { title: 'Notified', dataIndex: 'createdAt', render: formatDateTime },
          ]}
        />
      </Card>
    </>
  );
}
