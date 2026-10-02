import { UserAddOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useApiQuery, usePagedQuery } from '../../api/hooks';
import type { Agency, AgentStatus, AgentView, HierarchyNode } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencySummary, IssuanceBlockAlert } from '../../components/admin/AgencySummary';
import { AGENT_STATUSES, AGENT_TYPE_LABELS } from '../../components/admin/agents';
import { HierarchyTable } from '../../components/admin/HierarchyTable';
import { enumOptions } from '../../components/admin/useCodes';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDate, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

const memberPath = (id: string) => `/portal/team/${id}`;

function TeamTable() {
  const [search, setSearch] = useState<string>();
  const [status, setStatus] = useState<AgentStatus>();
  const team = usePagedQuery<AgentView>('/portal/agents', { search, status });

  return (
    <Card
      title="Team members"
      className="content-card"
      extra={
        <Flex gap={8} wrap>
          <Input.Search
            allowClear
            placeholder="Agent code or name"
            aria-label="Search agents"
            style={{ width: 260 }}
            onSearch={(value) => {
              setSearch(value.trim() || undefined);
              team.resetPage();
            }}
          />
          <Select
            allowClear
            placeholder="Status"
            aria-label="Status"
            style={{ width: 160 }}
            options={enumOptions(AGENT_STATUSES, humanise)}
            value={status}
            onChange={(value) => {
              setStatus(value);
              team.resetPage();
            }}
          />
        </Flex>
      }
    >
      <Table<AgentView>
        size="middle"
        rowKey="id"
        loading={team.isFetching}
        dataSource={team.items}
        pagination={team.pagination}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No agents match the filters' }}
        columns={[
          {
            title: 'Agent code',
            dataIndex: 'agentCode',
            render: (code: string, agent) => <Link to={memberPath(agent.id)}>{code}</Link>,
          },
          { title: 'Name', dataIndex: 'fullName' },
          {
            title: 'Type',
            dataIndex: 'agentType',
            render: (type: AgentView['agentType']) => AGENT_TYPE_LABELS[type],
          },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (value: string) => <StatusTag status={value} />,
          },
          {
            title: 'Reports to',
            key: 'parent',
            render: (_: unknown, agent) => agent.parent?.fullName ?? '–',
          },
          {
            title: 'Branch',
            dataIndex: 'branchName',
            render: (branch: string | null) => branch ?? '–',
          },
          { title: 'Licence expiry', dataIndex: 'licenceExpiry', render: formatDate },
          {
            title: 'AML',
            dataIndex: 'amlStatus',
            render: (value: string) => <StatusTag status={value} />,
          },
        ]}
      />
    </Card>
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
        meta={[
          agency.data && {
            label: 'Agency / bank',
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
      <Card title={banca ? 'Bank' : 'Agency'} className="content-card">
        <QueryState query={agency} rows={4}>
          {(data) => (
            <>
              <IssuanceBlockAlert agency={data} />
              <AgencySummary agency={data} />
            </>
          )}
        </QueryState>
      </Card>
      <Card title="Reporting hierarchy" className="content-card">
        <QueryState query={hierarchy} rows={4}>
          {(nodes) => <HierarchyTable nodes={nodes} memberPath={memberPath} />}
        </QueryState>
      </Card>
      <TeamTable />
    </>
  );
}
