import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { Agency, Channel } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencyFormModal } from '../../components/admin/AgencyFormModal';
import { CHANNEL_LABELS } from '../../components/admin/agents';
import { enumOptions } from '../../components/admin/useCodes';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { formatNumber, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

interface Filters {
  search?: string;
  channel?: Channel;
  status?: Agency['status'];
}

const STATUSES: Agency['status'][] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const CHANNEL_OPTIONS = Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value: value as Channel, label }));

/** BO-09: agencies (agency channel) and partner banks (bancassurance channel). */
export default function AgencyListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({});
  const [creating, setCreating] = useState(false);
  const agencies = usePagedQuery<Agency>('/backoffice/agencies', { ...filters });
  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    agencies.resetPage();
  };

  return (
    <>
      <PageHeader
        title="Agencies & banks"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Agencies & banks' }]}
        extra={
          can(P.boAgenciesManage) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              Add agency or bank
            </Button>
          )
        }
      />
      <FilterBar>
        <Input.Search allowClear placeholder="Code or name" aria-label="Search agencies" style={{ width: 240 }} onSearch={(value) => update({ search: value.trim() || undefined })} />
        <Select allowClear placeholder="Channel" aria-label="Channel" style={{ width: 170 }} options={CHANNEL_OPTIONS} onChange={(channel?: Channel) => update({ channel })} />
        <Select allowClear placeholder="Status" aria-label="Status" style={{ width: 150 }} options={enumOptions(STATUSES, humanise)} onChange={(status?: Agency['status']) => update({ status })} />
      </FilterBar>
      <Card className="content-card">
        <Table<Agency>
          size="middle"
          rowKey="id"
          loading={agencies.isFetching}
          dataSource={agencies.items}
          pagination={agencies.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No agencies or banks match the filters' }}
          columns={[
            { title: 'Code', dataIndex: 'code', render: (code: string, agency) => <Link to={`/backoffice/agencies/${agency.id}`}>{code}</Link> },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Channel', dataIndex: 'channel', render: (channel: Channel) => CHANNEL_LABELS[channel] },
            { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
            { title: 'Active agents', dataIndex: 'activeAgents', align: 'right', render: formatNumber },
            {
              title: 'New business',
              dataIndex: 'issuanceBlocked',
              render: (blocked: boolean) => (blocked ? <StatusTag status="SUSPENDED" label="Blocked" /> : <StatusTag status="ACTIVE" label="Permitted" />),
            },
            { title: 'Email', dataIndex: 'email', render: (email: string | null) => email ?? '–' },
            { title: 'Phone', dataIndex: 'phone', render: (phone: string | null) => phone ?? '–' },
          ]}
        />
      </Card>
      {creating && <AgencyFormModal onClose={() => setCreating(false)} onSaved={(agency) => navigate(`/backoffice/agencies/${agency.id}`)} />}
    </>
  );
}
