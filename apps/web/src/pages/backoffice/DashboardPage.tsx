import {
  AlertOutlined,
  ApiOutlined,
  CheckSquareOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  MedicineBoxOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Card, Col, Row, Table } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { BackofficeDashboard, Channel } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ApprovalTable } from '../../components/admin/ApprovalTable';
import { CHANNEL_LABELS } from '../../components/admin/agents';
import { ProductionTrend } from '../../components/admin/ProductionTrend';
import { DataTable, dateTimeColumn, textColumn } from '../../components/DataTable';
import { KpiGrid, KpiTile, type KpiTone } from '../../components/KpiTile';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { type WorkItem, WorkQueue } from '../../components/WorkQueue';
import { formatMoney, formatNumber, humanise } from '../../utils/format';
import { APPROVE_PERMISSIONS, P } from '../../utils/permissions';

type Pending = BackofficeDashboard['pending'];
type Kpis = NonNullable<BackofficeDashboard['kpis']>;
type BlockedAgency = NonNullable<BackofficeDashboard['blockedAgencies']>[number];

interface Queue {
  key: string;
  label: string;
  icon: ReactNode;
  count: number;
  to: string;
  meta?: ReactNode;
  tone: 'default' | 'warning' | 'danger';
}

const warnIf = (count: number) => (count > 0 ? 'warning' : 'default');

/** BO-21: work waiting for the signed-in user, each linking to its queue. */
function useQueues(pending: Pending): Queue[] {
  const { can } = useAuth();
  const queues: (Queue | false)[] = [
    APPROVE_PERMISSIONS.some(can) && {
      key: 'approvals',
      label: 'Awaiting my approval',
      icon: <CheckSquareOutlined />,
      count: pending.myApprovals,
      to: '/backoffice/approvals',
      tone: warnIf(pending.myApprovals),
    },
    can(P.boAgentsView) && {
      key: 'agents',
      label: 'Agent registrations',
      icon: <UserAddOutlined />,
      count: pending.pendingAgents,
      to: '/backoffice/agents?status=PENDING',
      tone: 'default',
    },
    can(P.boAmlReview) && {
      key: 'aml',
      label: 'AML cases to review',
      icon: <SafetyCertificateOutlined />,
      count: pending.amlReview,
      to: '/backoffice/aml',
      tone: warnIf(pending.amlReview),
    },
    can(P.boDocumentsVerify) && {
      key: 'documents',
      label: 'Documents to verify',
      icon: <FileSearchOutlined />,
      count: pending.documentsToVerify,
      to: '/backoffice/documents',
      tone: 'default',
    },
    can(P.boPaymentsView) && {
      key: 'payments',
      label: 'Payments to verify',
      icon: <WalletOutlined />,
      count: pending.paymentsPending,
      meta: <Money value={pending.paymentsPendingAmount} />,
      to: '/backoffice/payments?status=PENDING_VERIFICATION',
      tone: warnIf(pending.paymentsPending),
    },
    can(P.boClaimsManage) && {
      key: 'claims',
      label: 'Open claims',
      icon: <MedicineBoxOutlined />,
      count: pending.claimsOpen,
      to: '/backoffice/claims',
      tone: 'default',
    },
    can(P.boIssuesManage) && {
      key: 'issues',
      label: 'Open issues',
      icon: <AlertOutlined />,
      count: pending.issuesOpen,
      meta: pending.issuesBreached > 0 ? `${pending.issuesBreached} past SLA` : 'All within SLA',
      to: pending.issuesBreached > 0 ? '/backoffice/issues?breached=true' : '/backoffice/issues',
      tone: pending.issuesBreached > 0 ? 'danger' : 'default',
    },
    can(P.boIntegrationManage) && {
      key: 'integration',
      label: 'Integration dead letters',
      icon: <ApiOutlined />,
      count: pending.integrationDead,
      to: '/backoffice/integration',
      tone: pending.integrationDead > 0 ? 'danger' : 'default',
    },
  ];
  return queues.filter((queue): queue is Queue => Boolean(queue));
}

const queueTone = (queue: Queue): KpiTone => (queue.count > 0 ? queue.tone : 'default');

function QueueTiles({ queues }: { queues: Queue[] }) {
  return (
    <KpiGrid columns={4}>
      {queues.map((queue) => (
        <KpiTile
          key={queue.key}
          label={queue.label}
          icon={queue.icon}
          value={formatNumber(queue.count)}
          sub={queue.meta}
          to={queue.to}
          tone={queueTone(queue)}
        />
      ))}
    </KpiGrid>
  );
}

/** BO-20: management KPIs for the month and year to date. */
function ManagementTiles({ kpis }: { kpis: Kpis }) {
  return (
    <KpiGrid columns={4}>
      <KpiTile
        label="Issued this month"
        icon={<FileProtectOutlined />}
        tone="accent"
        value={formatNumber(kpis.policiesMtd)}
        sub={<Money value={kpis.contributionMtd} />}
        to="/backoffice/policies"
      />
      <KpiTile
        label="Issued this year"
        icon={<RiseOutlined />}
        value={formatNumber(kpis.policiesYtd)}
        sub={<Money value={kpis.contributionYtd} />}
        to="/backoffice/policies"
      />
      <KpiTile
        label="Outstanding contribution"
        icon={<WalletOutlined />}
        value={formatMoney(kpis.outstandingAmount)}
        sub={`${formatMoney(kpis.overdueAmount)} overdue · ${formatNumber(kpis.overdueCount)} policies`}
        tone={kpis.overdueCount > 0 ? 'warning' : 'default'}
        to="/backoffice/payments"
      />
      <KpiTile
        label="Active agents and officers"
        icon={<TeamOutlined />}
        value={formatNumber(kpis.activeAgents)}
        sub={`${formatNumber(kpis.activeAgencies)} agencies and banks`}
        to="/backoffice/agents?status=ACTIVE"
      />
    </KpiGrid>
  );
}

function PendingByType({ pending }: { pending: Pending }) {
  const rows = Object.entries(pending.pendingByType).map(([type, count]) => ({ type, count }));
  return (
    <WorkQueue
      emptyLabel="No pending requests"
      items={rows.map((row) => ({
        key: row.type,
        label: humanise(row.type),
        count: row.count,
        to: '/backoffice/approvals?tab=all',
      }))}
    />
  );
}

function ChannelSplit({ rows }: { rows: NonNullable<BackofficeDashboard['byChannel']> }) {
  const total = rows.reduce((sum, row) => sum + Number(row.contribution), 0);
  return (
    <Table
      size="small"
      rowKey="channel"
      pagination={false}
      dataSource={rows}
      locale={{ emptyText: 'No policies issued' }}
      columns={[
        {
          title: 'Channel',
          dataIndex: 'channel',
          render: (channel: Channel) => CHANNEL_LABELS[channel],
        },
        { title: 'Policies', dataIndex: 'policies', align: 'right', render: formatNumber },
        {
          title: 'Contribution',
          dataIndex: 'contribution',
          align: 'right',
          render: (value: string) => <Money value={value} />,
        },
        {
          title: 'Share',
          key: 'share',
          align: 'right',
          width: 70,
          render: (_: unknown, row) =>
            total > 0 ? `${Math.round((Number(row.contribution) / total) * 100)}%` : '–',
        },
      ]}
    />
  );
}

function ProductSplit({ rows }: { rows: NonNullable<BackofficeDashboard['byProduct']> }) {
  return (
    <Table
      size="small"
      rowKey="code"
      pagination={false}
      dataSource={rows}
      locale={{ emptyText: 'No policies issued' }}
      columns={[
        { title: 'Product', dataIndex: 'name', ellipsis: true },
        {
          title: 'Policies',
          dataIndex: 'policies',
          align: 'right',
          width: 76,
          render: formatNumber,
        },
        {
          title: 'Contribution',
          dataIndex: 'contribution',
          align: 'right',
          width: 130,
          render: (value: string) => <Money value={value} />,
        },
      ]}
    />
  );
}

function BlockedAgencies({ rows }: { rows: BlockedAgency[] }) {
  return (
    <DataTable<BlockedAgency>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={rows}
      scroll={{}}
      locale={{ emptyText: 'None blocked' }}
      columns={[
        {
          title: 'Code',
          dataIndex: 'code',
          width: 110,
          render: (code: string, row) => <Link to={`/backoffice/agencies/${row.id}`}>{code}</Link>,
        },
        textColumn('Name', 'name', 260),
        dateTimeColumn('Blocked since', 'issuanceBlockedAt', 160),
        textColumn('Reason', 'issuanceBlockReason'),
      ]}
    />
  );
}

function DashboardView({ data }: { data: BackofficeDashboard }) {
  const { can } = useAuth();
  const queues = useQueues(data.pending);
  const approver = APPROVE_PERMISSIONS.some(can);
  const { kpis } = data;

  const main: ReactNode[] = [];
  const side: ReactNode[] = [];
  if (approver) {
    main.push(
      <Card
        key="approvals"
        title="Awaiting my approval"
        extra={<Link to="/backoffice/approvals">Open inbox</Link>}
        className="content-card content-card--flush"
      >
        <ApprovalTable
          items={data.pending.myApprovalItems}
          compact
          emptyText="Nothing awaiting your decision"
        />
      </Card>,
    );
  }
  if (kpis) {
    side.push(
      <Card key="queues" title="Work queues" className="content-card content-card--flush">
        <WorkQueue
          emptyLabel="No queues"
          items={queues.map((queue): WorkItem => ({
            ...queue,
            tone: queue.count > 0 ? queue.tone : 'default',
          }))}
        />
      </Card>,
    );
  }
  if (approver) {
    side.push(
      <Card
        key="types"
        title="Pending requests by type"
        className="content-card content-card--flush"
      >
        <PendingByType pending={data.pending} />
      </Card>,
    );
  }
  if (kpis) {
    main.push(
      <Card
        key="trend"
        title="Production"
        extra={<span className="muted">Last 12 months</span>}
        className="content-card"
      >
        <ProductionTrend points={data.trend ?? []} />
      </Card>,
      <Card
        key="blocked"
        title="Agencies and banks blocked from new business"
        className="content-card content-card--flush"
      >
        <BlockedAgencies rows={data.blockedAgencies ?? []} />
      </Card>,
    );
    side.push(
      <Card
        key="products"
        title="By product"
        extra={<span className="muted">Year to date</span>}
        className="content-card content-card--flush"
      >
        <ProductSplit rows={data.byProduct ?? []} />
      </Card>,
      <Card
        key="channels"
        title="By channel"
        extra={<span className="muted">Year to date</span>}
        className="content-card content-card--flush"
      >
        <ChannelSplit rows={data.byChannel ?? []} />
      </Card>,
    );
  }

  return (
    <>
      {kpis ? <ManagementTiles kpis={kpis} /> : <QueueTiles queues={queues} />}
      {(main.length > 0 || side.length > 0) && (
        <Row gutter={16}>
          {main.length > 0 && (
            <Col xs={24} xl={side.length > 0 ? 16 : 24}>
              {main}
            </Col>
          )}
          {side.length > 0 && (
            <Col xs={24} xl={main.length > 0 ? 8 : 24}>
              {side}
            </Col>
          )}
        </Row>
      )}
    </>
  );
}

/** BO-20/21: work queues for every back-office user, plus management KPIs where permitted. */
export default function DashboardPage() {
  const dashboard = useApiQuery<BackofficeDashboard>('/backoffice/dashboard');
  return (
    <>
      <PageHeader title="Dashboard" />
      <QueryState query={dashboard}>{(data) => <DashboardView data={data} />}</QueryState>
    </>
  );
}
