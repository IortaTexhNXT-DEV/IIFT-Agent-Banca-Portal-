import { EditOutlined, SwapOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Row, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { AgentDetail, AmlScreening } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import { AgentStatusForm, AgentUpdateForm } from '../../components/admin/AgentMaintenance';
import { AgentProfile } from '../../components/admin/AgentProfile';
import { IssuanceTag } from '../../components/admin/AgencySummary';
import {
  AGENT_TYPE_LABELS,
  CHANNEL_LABELS,
  STATUS_TRANSITIONS,
} from '../../components/admin/agents';
import { renderScreeningMatches } from '../../components/admin/AmlMatchesTable';
import { SubAgentTable } from '../../components/admin/SubAgentTable';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { DataTable, dateTimeColumn, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { FieldGrid } from '../../components/FieldGrid';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime } from '../../utils/format';
import { P } from '../../utils/permissions';

type TabKey = 'documents' | 'hierarchy' | 'aml' | 'approvals' | 'maintenance';
type Maintenance = 'update' | 'status';

const agentLink = (agent: { id: string; agentCode: string; fullName: string }) => (
  <Link to={`/backoffice/agents/${agent.id}`}>{`${agent.fullName} (${agent.agentCode})`}</Link>
);

function count(label: string, total: number): string {
  return total > 0 ? `${label} (${total})` : label;
}

function Hierarchy({ agent }: { agent: AgentDetail }) {
  return (
    <>
      <FieldGrid
        columns={3}
        className="mb-16"
        items={[
          {
            key: 'parent',
            label: 'Reports to',
            value: agent.parent ? agentLink(agent.parent) : null,
          },
          { key: 'type', label: 'Type', value: AGENT_TYPE_LABELS[agent.agentType] },
          { key: 'count', label: 'Reporting agents', value: agent.subAgents.length },
        ]}
      />
      <SubAgentTable
        agents={agent.subAgents}
        memberPath={(agentId) => `/backoffice/agents/${agentId}`}
      />
    </>
  );
}

const SCREENING_COLUMNS: ColumnsType<AmlScreening> = [
  dateTimeColumn('Screened', 'createdAt', 160),
  { title: 'Provider', dataIndex: 'provider', width: 140 },
  { title: 'Highest score', dataIndex: 'score', width: 120, align: 'right', className: 'money' },
  {
    title: 'Matches',
    key: 'matches',
    width: 90,
    align: 'right',
    className: 'money',
    render: (_: unknown, row) => row.matches.length,
  },
  statusColumn('Outcome', 'status', 140),
  dateTimeColumn('Reviewed', 'reviewedAt', 160),
  textColumn('Review remarks', 'reviewRemarks'),
];

function Screenings({ screenings }: { screenings: AmlScreening[] }) {
  return (
    <DataTable<AmlScreening>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={screenings}
      scroll={{}}
      columns={SCREENING_COLUMNS}
      locale={{ emptyText: <EmptyState label="Not screened yet" /> }}
      expandable={{
        rowExpandable: (row) => row.matches.length > 0,
        expandedRowRender: renderScreeningMatches,
      }}
    />
  );
}

/** Status, portal login and agency facts kept beside the profile. */
function SideCards({ agent }: { agent: AgentDetail }) {
  const banca = agent.agency.channel === 'BANCA';
  return (
    <>
      <Card title="Status" className="content-card">
        <FieldGrid
          columns={2}
          items={[
            {
              key: 'status',
              label: 'Status',
              value: <StatusTag status={agent.status} />,
            },
            { key: 'aml', label: 'AML status', value: <StatusTag status={agent.amlStatus} /> },
            agent.statusReason && {
              key: 'reason',
              label: 'Status reason',
              value: agent.statusReason,
              span: 'full',
            },
            {
              key: 'login',
              label: 'Portal login',
              value: agent.user ? agent.user.username : 'Created on approval',
            },
            {
              key: 'loginStatus',
              label: 'Login status',
              value: agent.user ? <StatusTag status={agent.user.status} /> : null,
            },
            {
              key: 'lastLogin',
              label: 'Last sign-in',
              value: formatDateTime(agent.user?.lastLoginAt),
            },
            { key: 'registered', label: 'Registered', value: formatDateTime(agent.createdAt) },
            { key: 'activated', label: 'Activated', value: formatDateTime(agent.activatedAt) },
          ]}
        />
      </Card>
      <Card title={banca ? 'Bank' : 'Agency'} className="content-card">
        <FieldGrid
          columns={2}
          items={[
            {
              key: 'name',
              label: 'Name',
              value: (
                <Link to={`/backoffice/agencies/${agent.agency.id}`}>{agent.agency.name}</Link>
              ),
              span: 'full',
            },
            { key: 'code', label: 'Code', value: agent.agency.code },
            { key: 'channel', label: 'Channel', value: CHANNEL_LABELS[agent.agency.channel] },
            { key: 'status', label: 'Status', value: <StatusTag status={agent.agency.status} /> },
            {
              key: 'issuance',
              label: 'New business',
              value: <IssuanceTag blocked={agent.agency.issuanceBlocked} />,
            },
          ]}
        />
      </Card>
    </>
  );
}

function MaintenanceTab({
  agent,
  form,
  onChange,
}: {
  agent: AgentDetail;
  form: Maintenance;
  onChange(form: Maintenance): void;
}) {
  const canChangeStatus = STATUS_TRANSITIONS[agent.status].length > 0;
  return (
    <Card
      className="content-card"
      activeTabKey={form}
      tabProps={{ size: 'middle' }}
      onTabChange={(key) => onChange(key as Maintenance)}
      tabList={[
        { key: 'update', label: 'Profile update' },
        { key: 'status', label: 'Status change', disabled: !canChangeStatus },
      ]}
    >
      {form === 'update' ? (
        <AgentUpdateForm key={agent.version} agent={agent} />
      ) : (
        <AgentStatusForm key={agent.version} agent={agent} />
      )}
    </Card>
  );
}

/** BO-05..08/11/13: agent profile, hierarchy, login, documents, AML screening and approvals. */
export default function AgentDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const agent = useApiQuery<AgentDetail>(`/backoffice/agents/${id}`);
  const [tab, setTab] = useState<TabKey>('documents');
  const [maintenance, setMaintenance] = useState<Maintenance>('update');
  const openMaintenance = (form: Maintenance) => {
    setMaintenance(form);
    setTab('maintenance');
  };

  return (
    <QueryState query={agent}>
      {(data) => {
        const manage = can(P.boAgentsManage);
        const closed = data.status === 'TERMINATED' || data.status === 'REJECTED';
        const maintainable = manage && !closed;
        const pending = data.approvals.filter((approval) => approval.status === 'PENDING');
        return (
          <>
            <PageHeader
              title={data.fullName}
              tags={<StatusTag status={data.status} />}
              meta={[
                { label: 'Code', value: data.agentCode },
                { label: 'Type', value: AGENT_TYPE_LABELS[data.agentType] },
                { label: 'Agency / bank', value: data.agency.name },
              ]}
              breadcrumb={[
                { title: 'Home', to: '/backoffice' },
                { title: 'Agents & bankers', to: '/backoffice/agents' },
                { title: data.agentCode },
              ]}
              extra={
                maintainable && (
                  <>
                    {STATUS_TRANSITIONS[data.status].length > 0 && (
                      <Button icon={<SwapOutlined />} onClick={() => openMaintenance('status')}>
                        Change status
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => openMaintenance('update')}
                    >
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
                title={`${approval.requestNo} awaiting approval – ${approval.summary}`}
                action={
                  <Button
                    size="small"
                    onClick={() => navigate(`/backoffice/approvals/${approval.id}`)}
                  >
                    Open request
                  </Button>
                }
              />
            ))}
            <Row gutter={16}>
              <Col xs={24} xl={16}>
                <Card title="Profile" className="content-card">
                  <AgentProfile
                    agent={data}
                    parentLink={agentLink}
                    omit={['code', 'type', 'status', 'aml', 'registered', 'activated']}
                  />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <SideCards agent={data} />
              </Col>
            </Row>
            <Tabs
              className="page-tabs"
              activeKey={tab}
              onChange={(key) => setTab(key as TabKey)}
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
                        canUpload={maintainable}
                        canReview={can(P.boDocumentsVerify)}
                        checkRequired={data.status === 'PENDING'}
                      />
                    </Card>
                  ),
                },
                {
                  key: 'hierarchy',
                  label: count('Hierarchy', data.subAgents.length),
                  children: (
                    <Card className="content-card">
                      <Hierarchy agent={data} />
                    </Card>
                  ),
                },
                {
                  key: 'aml',
                  label: count('AML screening', data.screenings?.length ?? 0),
                  children: (
                    <Card className="content-card">
                      <Screenings screenings={data.screenings ?? []} />
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
                ...(maintainable
                  ? [
                      {
                        key: 'maintenance',
                        label: 'Maintenance',
                        children: (
                          <MaintenanceTab
                            agent={data}
                            form={maintenance}
                            onChange={setMaintenance}
                          />
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          </>
        );
      }}
    </QueryState>
  );
}
