import { Input, Select } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { AmlStatus, Participant } from '../../api/types';
import { humanise } from '../../utils/format';
import { DataTable, dateColumn, statusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { TableCard } from '../TableCard';
import { useSalesLinks } from './useSalesLinks';

type Filters = {
  search?: string;
  type?: Participant['type'];
  amlStatus?: AmlStatus;
};

const TYPE_OPTIONS = (['INDIVIDUAL', 'CORPORATE'] as const).map((value) => ({
  value,
  label: humanise(value),
}));
const AML_OPTIONS = (['CLEAR', 'FLAGGED', 'REJECTED', 'NOT_SCREENED'] as const).map((value) => ({
  value,
  label: humanise(value),
}));

/** AP-11/12: searchable participant register (portal: own agency; back-office: all). */
export function ParticipantList({
  path,
}: {
  path: '/portal/participants' | '/backoffice/participants';
}) {
  const links = useSalesLinks();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({});
  const participants = usePagedQuery<Participant>(path, filters);
  const set = (patch: Partial<Filters>) => {
    setFilters({ ...filters, ...patch });
    participants.resetPage();
  };

  return (
    <TableCard
      toolbar={
        <>
          <Input.Search
            placeholder="Name, participant no. or mobile"
            aria-label="Search participants"
            allowClear
            onSearch={(search) => set({ search: search.trim() || undefined })}
            className="filter-search"
          />
          <Select
            placeholder="Type"
            aria-label="Participant type"
            allowClear
            options={TYPE_OPTIONS}
            value={filters.type}
            onChange={(type) => set({ type })}
            className="filter-select"
          />
          <Select
            placeholder="AML status"
            aria-label="AML status"
            allowClear
            options={AML_OPTIONS}
            value={filters.amlStatus}
            onChange={(amlStatus) => set({ amlStatus })}
            className="filter-select"
          />
        </>
      }
    >
      <DataTable<Participant>
        rowKey="id"
        loading={participants.isFetching}
        dataSource={participants.items}
        pagination={participants.pagination}
        scroll={{}}
        onRowClick={(participant) => navigate(links.participant(participant.id))}
        locale={{ emptyText: <EmptyState label="No participants" /> }}
        columns={[
          {
            title: 'Participant no.',
            dataIndex: 'participantNo',
            width: 140,
            render: (value: string, participant) => (
              <Link to={links.participant(participant.id)}>{value}</Link>
            ),
          },
          textColumn('Name', 'fullName'),
          { title: 'Type', dataIndex: 'type', width: 110, render: humanise },
          { title: 'ID', dataIndex: 'idNumberMasked', width: 130 },
          dateColumn('Date of birth', 'dateOfBirth', 115),
          { title: 'Mobile', dataIndex: 'mobile', width: 130 },
          statusColumn('AML', 'amlStatus', 120),
          dateColumn('Registered', 'createdAt', 120),
        ]}
      />
    </TableCard>
  );
}
