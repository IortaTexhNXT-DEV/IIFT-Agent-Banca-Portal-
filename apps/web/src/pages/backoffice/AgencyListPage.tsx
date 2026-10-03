import { PlusOutlined } from '@ant-design/icons';
import { Button, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { Agency, Channel } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencyFormModal } from '../../components/admin/AgencyFormModal';
import { IssuanceTag } from '../../components/admin/AgencySummary';
import { CHANNEL_LABELS } from '../../components/admin/agents';
import { enumOptions } from '../../components/admin/useCodes';
import { DataTable, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { formatNumber, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

interface Filters {
  search?: string;
  channel?: Channel;
  status?: Agency['status'];
}

const STATUSES: Agency['status'][] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];
const CHANNEL_OPTIONS = Object.entries(CHANNEL_LABELS).map(([value, label]) => ({
  value: value as Channel,
  label,
}));

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

  const columns: ColumnsType<Agency> = [
    {
      title: 'Code',
      dataIndex: 'code',
      width: 120,
      fixed: 'left',
      render: (code: string, agency) => (
        <Link to={`/backoffice/agencies/${agency.id}`}>{code}</Link>
      ),
    },
    textColumn('Name', 'name'),
    {
      title: 'Channel',
      dataIndex: 'channel',
      width: 130,
      render: (channel: Channel) => CHANNEL_LABELS[channel],
    },
    statusColumn('Status', 'status', 110),
    {
      title: 'Active agents',
      dataIndex: 'activeAgents',
      width: 110,
      align: 'right',
      render: formatNumber,
    },
    {
      title: 'New business',
      dataIndex: 'issuanceBlocked',
      width: 120,
      render: (blocked: boolean) => <IssuanceTag blocked={blocked} />,
    },
    textColumn('E-mail', 'email', 200),
    textColumn('Phone', 'phone', 120),
  ];

  return (
    <>
      <PageHeader
        title="Agencies & banks"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Agencies & banks' }]}
        extra={
          can(P.boAgenciesManage) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
              Add agency or bank
            </Button>
          )
        }
      />
      <TableCard
        toolbar={
          <>
            <Input.Search
              allowClear
              placeholder="Code or name"
              aria-label="Search agencies"
              className="filter-search"
              onSearch={(value) => update({ search: value.trim() || undefined })}
            />
            <Select
              allowClear
              placeholder="Channel"
              aria-label="Channel"
              className="filter-select"
              options={CHANNEL_OPTIONS}
              onChange={(channel?: Channel) => update({ channel })}
            />
            <Select
              allowClear
              placeholder="Status"
              aria-label="Status"
              className="filter-select"
              options={enumOptions(STATUSES, humanise)}
              onChange={(status?: Agency['status']) => update({ status })}
            />
          </>
        }
      >
        <DataTable<Agency>
          rowKey="id"
          loading={agencies.isFetching}
          dataSource={agencies.items}
          pagination={agencies.pagination}
          columns={columns}
          onRowClick={(agency) => navigate(`/backoffice/agencies/${agency.id}`)}
          locale={{ emptyText: <EmptyState label="No agencies or banks match the filters" /> }}
        />
      </TableCard>
      {creating && (
        <AgencyFormModal
          onClose={() => setCreating(false)}
          onSaved={(agency) => navigate(`/backoffice/agencies/${agency.id}`)}
        />
      )}
    </>
  );
}
