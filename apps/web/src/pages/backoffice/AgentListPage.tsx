import { UserAddOutlined } from '@ant-design/icons';
import { Button, Card, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { AgentStatus, AgentType, AgentView, Channel } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencySelect } from '../../components/admin/AgencySelect';
import { AGENT_STATUSES, AGENT_TYPE_LABELS, CHANNEL_LABELS } from '../../components/admin/agents';
import { enumOptions } from '../../components/admin/useCodes';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { formatDate, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

interface Filters {
  search?: string;
  idNumber?: string;
  agencyId?: string;
  channel?: Channel;
  status?: AgentStatus;
  agentType?: AgentType;
}

const TYPE_OPTIONS = Object.entries(AGENT_TYPE_LABELS).map(([value, label]) => ({ value: value as AgentType, label }));
const CHANNEL_OPTIONS = Object.entries(CHANNEL_LABELS).map(([value, label]) => ({ value: value as Channel, label }));

/** BO-05..07: search agents and bank officers by code, name, ID number, agency, channel, status and type. */
export default function AgentListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<Filters>({ status: (searchParams.get('status') as AgentStatus | null) ?? undefined });
  const agents = usePagedQuery<AgentView>('/backoffice/agents', { ...filters });
  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    agents.resetPage();
  };

  return (
    <>
      <PageHeader
        title="Agents & bankers"
        subtitle="Main agents, sub-agents and bank officers of every agency and bank"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Agents & bankers' }]}
        extra={
          can(P.boAgentsManage) && (
            <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate('/backoffice/agents/new')}>
              Register agent
            </Button>
          )
        }
      />
      <FilterBar>
        <Input.Search allowClear placeholder="Agent code or name" aria-label="Search by code or name" style={{ width: 220 }} onSearch={(value) => update({ search: value.trim() || undefined })} />
        <Input.Search allowClear placeholder="IC / passport no. (exact)" aria-label="Search by ID number" style={{ width: 220 }} onSearch={(value) => update({ idNumber: value.trim() || undefined })} />
        <AgencySelect allowClear placeholder="All agencies and banks" aria-label="Agency or bank" style={{ width: 260 }} onChange={(agencyId) => update({ agencyId })} />
        <Select allowClear placeholder="Channel" aria-label="Channel" style={{ width: 150 }} options={CHANNEL_OPTIONS} onChange={(channel?: Channel) => update({ channel })} />
        <Select allowClear placeholder="Type" aria-label="Agent type" style={{ width: 150 }} options={TYPE_OPTIONS} onChange={(agentType?: AgentType) => update({ agentType })} />
        <Select allowClear placeholder="Status" aria-label="Status" style={{ width: 150 }} value={filters.status} options={enumOptions(AGENT_STATUSES, humanise)} onChange={(status?: AgentStatus) => update({ status })} />
      </FilterBar>
      <Card className="content-card">
        <Table<AgentView>
          size="middle"
          rowKey="id"
          loading={agents.isFetching}
          dataSource={agents.items}
          pagination={agents.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No agents match the filters' }}
          columns={[
            { title: 'Agent code', dataIndex: 'agentCode', render: (code: string, agent) => <Link to={`/backoffice/agents/${agent.id}`}>{code}</Link> },
            { title: 'Name', dataIndex: 'fullName' },
            { title: 'Type', dataIndex: 'agentType', render: (type: AgentType) => AGENT_TYPE_LABELS[type] },
            { title: 'Agency / bank', key: 'agency', render: (_: unknown, agent) => <Link to={`/backoffice/agencies/${agent.agency.id}`}>{agent.agency.name}</Link> },
            { title: 'Reports to', key: 'parent', render: (_: unknown, agent) => agent.parent?.fullName ?? '–' },
            { title: 'ID no.', dataIndex: 'idNumberMasked' },
            { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
            { title: 'AML', dataIndex: 'amlStatus', render: (status: string) => <StatusTag status={status} /> },
            { title: 'Licence expiry', dataIndex: 'licenceExpiry', render: formatDate },
          ]}
        />
      </Card>
    </>
  );
}
