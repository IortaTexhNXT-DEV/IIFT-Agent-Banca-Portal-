import { UserAddOutlined } from '@ant-design/icons';
import { Button, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { AgentStatus, AgentType, AgentView, Channel } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencySelect } from '../../components/admin/AgencySelect';
import { AGENT_STATUSES, AGENT_TYPE_LABELS, CHANNEL_LABELS } from '../../components/admin/agents';
import { enumOptions } from '../../components/admin/useCodes';
import { DataTable, dateColumn, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

interface Filters {
  search?: string;
  idNumber?: string;
  agencyId?: string;
  channel?: Channel;
  status?: AgentStatus;
  agentType?: AgentType;
}

const TYPE_OPTIONS = Object.entries(AGENT_TYPE_LABELS).map(([value, label]) => ({
  value: value as AgentType,
  label,
}));
const CHANNEL_OPTIONS = Object.entries(CHANNEL_LABELS).map(([value, label]) => ({
  value: value as Channel,
  label,
}));

/** BO-05..07: search agents and bank officers by code, name, ID number, agency, channel, status and type. */
export default function AgentListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({
    status: (searchParams.get('status') as AgentStatus | null) ?? undefined,
  });
  const agents = usePagedQuery<AgentView>('/backoffice/agents', { ...filters });
  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    agents.resetPage();
  };

  const columns: ColumnsType<AgentView> = [
    {
      title: 'Agent code',
      dataIndex: 'agentCode',
      width: 120,
      fixed: 'left',
      render: (code: string, agent) => <Link to={`/backoffice/agents/${agent.id}`}>{code}</Link>,
    },
    textColumn('Name', 'fullName'),
    {
      title: 'Type',
      dataIndex: 'agentType',
      width: 120,
      render: (type: AgentType) => AGENT_TYPE_LABELS[type],
    },
    {
      title: 'Agency / bank',
      key: 'agency',
      width: 130,
      render: (_: unknown, agent) => (
        <Link to={`/backoffice/agencies/${agent.agency.id}`}>{agent.agency.code}</Link>
      ),
    },
    textColumn('Reports to', ['parent', 'fullName'], 170),
    statusColumn('Status', 'status', 120),
    statusColumn('AML', 'amlStatus', 110),
    dateColumn('Licence expiry', 'licenceExpiry', 130),
  ];

  return (
    <>
      <PageHeader
        title="Agents & bankers"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Agents & bankers' }]}
        extra={
          can(P.boAgentsManage) && (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => navigate('/backoffice/agents/new')}
            >
              Register agent
            </Button>
          )
        }
      />
      <TableCard
        toolbar={
          <>
            <Input.Search
              allowClear
              placeholder="Agent code or name"
              aria-label="Search by code or name"
              className="filter-select filter-select--wide"
              onSearch={(value) => update({ search: value.trim() || undefined })}
            />
            <Input.Search
              allowClear
              placeholder="IC / passport no."
              aria-label="Search by ID number"
              className="filter-select"
              onSearch={(value) => update({ idNumber: value.trim() || undefined })}
            />
            <AgencySelect
              allowClear
              placeholder="Agency / bank"
              aria-label="Agency or bank"
              className="filter-select filter-select--wide"
              onChange={(agencyId) => update({ agencyId })}
            />
            <Select
              allowClear
              placeholder="Channel"
              aria-label="Channel"
              className="filter-select filter-select--narrow"
              options={CHANNEL_OPTIONS}
              onChange={(channel?: Channel) => update({ channel })}
            />
            <Select
              allowClear
              placeholder="Type"
              aria-label="Agent type"
              className="filter-select filter-select--narrow"
              options={TYPE_OPTIONS}
              onChange={(agentType?: AgentType) => update({ agentType })}
            />
            <Select
              allowClear
              placeholder="Status"
              aria-label="Status"
              className="filter-select filter-select--narrow"
              value={filters.status}
              options={enumOptions(AGENT_STATUSES, humanise)}
              onChange={(status?: AgentStatus) => update({ status })}
            />
          </>
        }
      >
        <DataTable<AgentView>
          rowKey="id"
          loading={agents.isFetching}
          dataSource={agents.items}
          pagination={agents.pagination}
          columns={columns}
          onRowClick={(agent) => navigate(`/backoffice/agents/${agent.id}`)}
          locale={{ emptyText: <EmptyState label="No agents match the filters" /> }}
        />
      </TableCard>
    </>
  );
}
