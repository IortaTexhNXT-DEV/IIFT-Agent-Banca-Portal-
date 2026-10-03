import { UserAddOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Input, Select, Tabs } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApiQuery, usePagedQuery } from '../../api/hooks';
import type { Agency, AgentStatus, AgentView, HierarchyNode } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencySummary } from '../../components/admin/AgencySummary';
import { AGENT_STATUSES, AGENT_TYPE_LABELS } from '../../components/admin/agents';
import { HierarchyTable } from '../../components/admin/HierarchyTable';
import { enumOptions } from '../../components/admin/useCodes';
import { DataTable, dateColumn, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

const memberPath = (id: string) => `/portal/team/${id}`;

function TeamTable() {
  const navigate = useNavigate();
  const [search, setSearch] = useState<string>();
  const [status, setStatus] = useState<AgentStatus>();
  const team = usePagedQuery<AgentView>('/portal/agents', { search, status });

  return (
    <TableCard
      toolbar={
        <>
          <Input.Search
            allowClear
            placeholder="Agent code or name"
            aria-label="Search agents"
            className="filter-search"
            onSearch={(value) => {
              setSearch(value.trim() || undefined);
              team.resetPage();
            }}
          />
          <Select
            allowClear
            placeholder="Status"
            aria-label="Status"
            className="filter-select"
            options={enumOptions(AGENT_STATUSES, humanise)}
            value={status}
            onChange={(value) => {
              setStatus(value);
              team.resetPage();
            }}
          />
        </>
      }
    >
      <DataTable<AgentView>
        rowKey="id"
        loading={team.isFetching}
        dataSource={team.items}
        pagination={team.pagination}
        scroll={{}}
        onRowClick={(agent) => navigate(memberPath(agent.id))}
        locale={{ emptyText: <EmptyState label="No agents yet" /> }}
        columns={[
          {
            title: 'Agent code',
            dataIndex: 'agentCode',
            width: 120,
            render: (code: string, agent) => <Link to={memberPath(agent.id)}>{code}</Link>,
          },
          textColumn('Name', 'fullName'),
          {
            title: 'Type',
            dataIndex: 'agentType',
            width: 120,
            render: (type: AgentView['agentType']) => AGENT_TYPE_LABELS[type],
          },
          statusColumn('Status', 'status', 115),
          textColumn('Reports to', ['parent', 'fullName'], 170),
          textColumn('Branch', 'branchName', 130),
          dateColumn('Licence expiry', 'licenceExpiry', 120),
          statusColumn('AML', 'amlStatus', 125),
        ]}
      />
    </TableCard>
  );
}

/** AP-09/10/12: agency information, reporting hierarchy and team members. */
export default function TeamPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const agency = useApiQuery<Agency>('/portal/agency');
  const hierarchy = useApiQuery<HierarchyNode[]>('/portal/hierarchy');
  const banca = agency.data?.channel === 'BANCA';

  return (
    <>
      <PageHeader
        title="Team & hierarchy"
        tags={agency.data && <StatusTag status={agency.data.status} />}
        meta={[
          agency.data && {
            label: banca ? 'Bank' : 'Agency',
            value: `${agency.data.name} (${agency.data.code})`,
          },
        ]}
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Team & hierarchy' }]}
        extra={
          can(P.portalAgentRegister) && (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => navigate('/portal/team/register')}
            >
              {banca ? 'Register bank officer' : 'Register agent'}
            </Button>
          )
        }
      />
      {agency.data?.issuanceBlocked && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="New business blocked: contributions overdue"
          action={
            <Link to="/portal/billing">
              <Button size="small">Go to billing</Button>
            </Link>
          }
        />
      )}
      <Card title={banca ? 'Bank' : 'Agency'} className="content-card">
        <QueryState query={agency} rows={4}>
          {(data) => <AgencySummary agency={data} />}
        </QueryState>
      </Card>
      <Tabs
        className="page-tabs"
        items={[
          { key: 'members', label: 'Team members', children: <TeamTable /> },
          {
            key: 'hierarchy',
            label: 'Reporting hierarchy',
            children: (
              <Card className="content-card content-card--flush">
                <QueryState query={hierarchy} rows={4}>
                  {(nodes) => <HierarchyTable nodes={nodes} memberPath={memberPath} />}
                </QueryState>
              </Card>
            ),
          },
        ]}
      />
    </>
  );
}
