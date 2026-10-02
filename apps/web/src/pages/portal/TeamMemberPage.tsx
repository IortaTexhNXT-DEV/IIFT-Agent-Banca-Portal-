import { Card, Flex, Table, Tabs } from 'antd';
import { Link, useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { AgentDetail } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import { AgentProfile } from '../../components/admin/AgentProfile';
import { AGENT_TYPE_LABELS } from '../../components/admin/agents';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { P } from '../../utils/permissions';

type SubAgent = AgentDetail['subAgents'][number];

function SubAgentTable({ agents }: { agents: SubAgent[] }) {
  return (
    <Table<SubAgent>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={agents}
      locale={{ emptyText: 'No agents report to this agent' }}
      columns={[
        { title: 'Agent code', dataIndex: 'agentCode', render: (code: string, agent) => <Link to={`/portal/team/${agent.id}`}>{code}</Link> },
        { title: 'Name', dataIndex: 'fullName' },
        { title: 'Type', dataIndex: 'agentType', render: (type: SubAgent['agentType']) => AGENT_TYPE_LABELS[type] },
        { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
      ]}
    />
  );
}

/** AP-09/46/47: a team member's profile, documents, reporting line and approval history. */
export default function TeamMemberPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const agent = useApiQuery<AgentDetail>(`/portal/agents/${id}`);

  return (
    <QueryState query={agent}>
      {(data) => (
        <>
          <PageHeader
            title={
              <Flex gap={12} align="center" wrap>
                {data.fullName}
                <StatusTag status={data.status} />
              </Flex>
            }
            subtitle={`${data.agentCode} · ${AGENT_TYPE_LABELS[data.agentType]} · ${data.agency.name}`}
            breadcrumb={[{ title: 'Team & hierarchy', to: '/portal/team' }, { title: data.agentCode }]}
          />
          <Card title="Profile" className="content-card">
            <AgentProfile agent={data} parentLink={(parent) => <Link to={`/portal/team/${parent.id}`}>{`${parent.fullName} (${parent.agentCode})`}</Link>} />
          </Card>
          <Card className="content-card">
            <Tabs
              destroyOnHidden
              items={[
                {
                  key: 'documents',
                  label: 'Documents',
                  children: (
                    <AgentDocuments
                      agentId={data.id}
                      channel={data.agency.channel}
                      canUpload={can(P.portalAgentRegister) && data.status !== 'TERMINATED'}
                      checkRequired={data.status === 'PENDING'}
                    />
                  ),
                },
                { key: 'team', label: `Reporting agents (${data.subAgents.length})`, children: <SubAgentTable agents={data.subAgents} /> },
                { key: 'approvals', label: 'Approval history', children: <ApprovalHistory approvals={data.approvals} /> },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
