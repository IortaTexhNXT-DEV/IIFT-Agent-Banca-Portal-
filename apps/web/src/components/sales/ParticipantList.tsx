import { Card, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { AmlStatus, Participant } from '../../api/types';
import { formatDate, humanise } from '../../utils/format';
import { FilterBar } from '../FilterBar';
import { StatusTag } from '../StatusTag';
import { useSalesLinks } from './useSalesLinks';

type Filters = {
  search?: string;
  type?: Participant['type'];
  amlStatus?: AmlStatus;
};

const TYPE_OPTIONS = (['INDIVIDUAL', 'CORPORATE'] as const).map((value) => ({ value, label: humanise(value) }));
const AML_OPTIONS = (['CLEAR', 'FLAGGED', 'REJECTED', 'NOT_SCREENED'] as const).map((value) => ({ value, label: humanise(value) }));

/** AP-11/12: searchable participant register (portal: own agency; back-office: all). */
export function ParticipantList({ path }: { path: '/portal/participants' | '/backoffice/participants' }) {
  const links = useSalesLinks();
  const [filters, setFilters] = useState<Filters>({});
  const participants = usePagedQuery<Participant>(path, filters);
  const set = (patch: Partial<Filters>) => {
    setFilters({ ...filters, ...patch });
    participants.resetPage();
  };

  return (
    <>
      <FilterBar>
        <Input.Search
          placeholder="Name, participant no. or mobile"
          aria-label="Search participants"
          allowClear
          onSearch={(search) => set({ search: search.trim() || undefined })}
          className="filter-search"
        />
        <Select placeholder="Type" aria-label="Participant type" allowClear options={TYPE_OPTIONS} value={filters.type} onChange={(type) => set({ type })} className="filter-select" />
        <Select placeholder="AML status" aria-label="AML status" allowClear options={AML_OPTIONS} value={filters.amlStatus} onChange={(amlStatus) => set({ amlStatus })} className="filter-select" />
      </FilterBar>
      <Card className="content-card" styles={{ body: { padding: 0 } }}>
        <Table<Participant>
          size="middle"
          rowKey="id"
          loading={participants.isFetching}
          dataSource={participants.items}
          pagination={participants.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No participants match the filters' }}
          columns={[
            { title: 'Participant no.', dataIndex: 'participantNo', render: (value: string, participant) => <Link to={links.participant(participant.id)}>{value}</Link> },
            { title: 'Name', dataIndex: 'fullName' },
            { title: 'Type', dataIndex: 'type', render: humanise },
            { title: 'ID', dataIndex: 'idNumberMasked' },
            { title: 'Date of birth', dataIndex: 'dateOfBirth', render: formatDate },
            { title: 'Mobile', dataIndex: 'mobile' },
            { title: 'AML', dataIndex: 'amlStatus', render: (status: string) => <StatusTag status={status} /> },
            { title: 'Registered', dataIndex: 'createdAt', render: formatDate },
          ]}
        />
      </Card>
    </>
  );
}
