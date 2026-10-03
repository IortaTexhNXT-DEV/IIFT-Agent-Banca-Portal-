import { Card, Tabs } from 'antd';
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

function count(label: string, total: number): string {
  return total > 0 ? `${label} (${total})` : label;
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
            title={data.fullName}
            tags={
              <>
                <StatusTag status={data.status} />
                <StatusTag status={data.amlStatus} />
              </>
            }
            meta={[
              { label: 'Code', value: data.agentCode },
              { label: 'Type', value: AGENT_TYPE_LABELS[data.agentType] },
              {
                label: data.agency.channel === 'BANCA' ? 'Bank' : 'Agency',
                value: data.agency.name,
              },
              data.parent && { label: 'Reports to', value: data.parent.fullName },
            ]}
            breadcrumb={[
              { title: 'Home', to: '/portal' },
              { title: 'Team & hierarchy', to: '/portal/team' },
              { title: data.agentCode },
            ]}
          />
          <Card title="Profile" className="content-card">
            <AgentProfile agent={data} parentLink={parentLink} columns={4} />
          </Card>
          <Tabs
            className="page-tabs"
            destroyOnHidden
            items={[
              {
                key: 'documents',
                label: count('Documents', data.documents.length),
                children: (
                  <Card className="content-card">
                    <AgentDocuments
                      agentId={data.id}
                      idType={data.idType}
                      channel={data.agency.channel}
                      canUpload={can(P.portalAgentRegister) && data.status !== 'TERMINATED'}
                      checkRequired={data.status === 'PENDING'}
                    />
                  </Card>
                ),
              },
              {
                key: 'team',
                label: count('Reporting agents', data.subAgents.length),
                children: (
                  <Card className="content-card content-card--flush">
                    <SubAgentTable
                      agents={data.subAgents}
                      memberPath={(agentId) => `/portal/team/${agentId}`}
                    />
                  </Card>
                ),
              },
              {
                key: 'approvals',
                label: count('Approval history', data.approvals.length),
                children: (
                  <Card className="content-card">
                    <ApprovalHistory approvals={data.approvals} />
                  </Card>
                ),
              },
            ]}
          />
        </>
      )}
    </QueryState>
  );
}
