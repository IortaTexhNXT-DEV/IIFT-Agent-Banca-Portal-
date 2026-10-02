import { EditOutlined, SwapOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Descriptions, Flex, Table, Tabs } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { AgentDetail, AmlScreening } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import { AgentStatusModal, AgentUpdateModal } from '../../components/admin/AgentMaintenance';
import { AgentProfile } from '../../components/admin/AgentProfile';
import { AGENT_TYPE_LABELS, STATUS_TRANSITIONS } from '../../components/admin/agents';
import { AmlMatchesTable } from '../../components/admin/AmlMatchesTable';
import { SubAgentTable } from '../../components/admin/SubAgentTable';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime } from '../../utils/format';
import { P } from '../../utils/permissions';

const agentLink = (agent: { id: string; agentCode: string; fullName: string }) => <Link to={`/backoffice/agents/${agent.id}`}>{`${agent.fullName} (${agent.agentCode})`}</Link>;

function Hierarchy({ agent }: { agent: AgentDetail }) {
  return (
    <>
      <Descriptions size="small" className="mb-16" items={[{ key: 'parent', label: 'Reports to', children: agent.parent ? agentLink(agent.parent) : 'No reporting line' }]} />
      <SubAgentTable agents={agent.subAgents} memberPath={(agentId) => `/backoffice/agents/${agentId}`} />
    </>
  );
}

function Screenings({ screenings }: { screenings: AmlScreening[] }) {
  return (
    <Table<AmlScreening>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={screenings}
      locale={{ emptyText: 'Not screened yet' }}
      expandable={{ rowExpandable: (row) => row.matches.length > 0, expandedRowRender: (row) => <AmlMatchesTable matches={row.matches} /> }}
      columns={[
        { title: 'Screened', dataIndex: 'createdAt', render: formatDateTime },
        { title: 'Provider', dataIndex: 'provider' },
        { title: 'Highest score', dataIndex: 'score', align: 'right' },
        { title: 'Matches', key: 'matches', align: 'right', render: (_: unknown, row) => row.matches.length },
        { title: 'Outcome', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
        { title: 'Reviewed', dataIndex: 'reviewedAt', render: formatDateTime },
        { title: 'Review remarks', dataIndex: 'reviewRemarks', ellipsis: true, render: (remarks: string | null) => remarks ?? '–' },
      ]}
    />
  );
}

/** BO-05..08/11/13: agent profile, hierarchy, login, documents, AML screening and approvals. */
export default function AgentDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const agent = useApiQuery<AgentDetail>(`/backoffice/agents/${id}`);
  const [dialog, setDialog] = useState<'update' | 'status'>();

  return (
    <QueryState query={agent}>
      {(data) => {
        const manage = can(P.boAgentsManage);
        const closed = data.status === 'TERMINATED' || data.status === 'REJECTED';
        const pending = data.approvals.filter((approval) => approval.status === 'PENDING');
        return (
          <>
            <PageHeader
              title={
                <Flex gap={12} align="center" wrap>
                  {data.fullName}
                  <StatusTag status={data.status} />
                </Flex>
              }
              subtitle={`${data.agentCode} · ${AGENT_TYPE_LABELS[data.agentType]} · ${data.agency.name}`}
              breadcrumb={[{ title: 'Agents & bankers', to: '/backoffice/agents' }, { title: data.agentCode }]}
              extra={
                manage &&
                !closed && (
                  <>
                    {STATUS_TRANSITIONS[data.status].length > 0 && (
                      <Button icon={<SwapOutlined />} onClick={() => setDialog('status')}>
                        Change status
                      </Button>
                    )}
                    <Button type="primary" icon={<EditOutlined />} onClick={() => setDialog('update')}>
                      Request profile update
                    </Button>
                  </>
                )
              }
            />
            {pending.map((approval) => (
              <Alert
                key={approval.id}
                className="mb-16"
                type="info"
                showIcon
                title={
                  <>
                    <Link to={`/backoffice/approvals/${approval.id}`}>{approval.requestNo}</Link> is awaiting approval: {approval.summary}
                  </>
                }
              />
            ))}
            <Card title="Profile" className="content-card">
              <AgentProfile
                agent={data}
                parentLink={agentLink}
                extra={[
                  { key: 'login', label: 'Portal login', children: data.user ? `${data.user.username} (${data.user.status.toLowerCase()})` : 'Created on approval' },
                  { key: 'lastLogin', label: 'Last sign-in', children: formatDateTime(data.user?.lastLoginAt) },
                  { key: 'agencyLink', label: data.agency.channel === 'BANCA' ? 'Bank record' : 'Agency record', children: <Link to={`/backoffice/agencies/${data.agency.id}`}>{data.agency.code}</Link> },
                ]}
              />
            </Card>
            <Card className="content-card">
              <Tabs
                destroyOnHidden
                items={[
                  {
                    key: 'documents',
                    label: 'Documents',
                    children: (
                      <AgentDocuments agentId={data.id} channel={data.agency.channel} canUpload={manage && !closed} canReview={can(P.boDocumentsVerify)} checkRequired={data.status === 'PENDING'} />
                    ),
                  },
                  { key: 'hierarchy', label: `Hierarchy (${data.subAgents.length})`, children: <Hierarchy agent={data} /> },
                  { key: 'aml', label: 'AML screening', children: <Screenings screenings={data.screenings ?? []} /> },
                  { key: 'approvals', label: 'Approval history', children: <ApprovalHistory approvals={data.approvals} /> },
                ]}
              />
            </Card>
            {dialog === 'update' && <AgentUpdateModal agent={data} onClose={() => setDialog(undefined)} />}
            {dialog === 'status' && <AgentStatusModal agent={data} onClose={() => setDialog(undefined)} />}
          </>
        );
      }}
    </QueryState>
  );
}
