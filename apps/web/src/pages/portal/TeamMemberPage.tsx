import { Card, Flex, Tabs } from 'antd';
import { Link, useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { AgentDetail } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import { AgentProfile } from '../../components/admin/AgentProfile';
import { AGENT_TYPE_LABELS } from '../../components/admin/agents';
import { SubAgentTable } from '../../components/admin/SubAgentTable';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { P } from '../../utils/permissions';

const parentLink = (parent: { id: string; agentCode: string; fullName: string }) => (
  <Link to={`/portal/team/${parent.id}`}>{`${parent.fullName} (${parent.agentCode})`}</Link>
);

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
            breadcrumb={[
              { title: 'Team & hierarchy', to: '/portal/team' },
              { title: data.agentCode },
            ]}
          />
          <Card title="Profile" className="content-card">
            <AgentProfile agent={data} parentLink={parentLink} />
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
                {
                  key: 'team',
                  label: `Reporting agents (${data.subAgents.length})`,
                  children: (
                    <SubAgentTable
                      agents={data.subAgents}
                      memberPath={(agentId) => `/portal/team/${agentId}`}
                    />
                  ),
                },
                {
                  key: 'approvals',
                  label: 'Approval history',
                  children: <ApprovalHistory approvals={data.approvals} />,
                },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
