import {
  AuditOutlined,
  BellOutlined,
  CloseCircleOutlined,
  CustomerServiceOutlined,
  ExclamationCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  SyncOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Col, Row } from 'antd';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiQuery } from '../../api/hooks';
import type { PortalDashboard } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AGENT_TYPE_LABELS } from '../../components/admin/agents';
import { DataTable, dateTimeColumn, textColumn } from '../../components/DataTable';
import { KpiGrid, KpiTile } from '../../components/KpiTile';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { type WorkItem, WorkQueue } from '../../components/WorkQueue';
import { brand } from '../../theme/theme';
import { formatMoney, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

type Counts = PortalDashboard['counts'];
type Activity = PortalDashboard['recentActivity'][number];

const RECENT_ROWS = 8;

function ProductionChart({ monthly }: { monthly: PortalDashboard['monthly'] }) {
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height={248}>
        <BarChart
          data={monthly.map((point) => ({
            ...point,
            label: dayjs(`${point.month}-01`).format('MMM YY'),
          }))}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} stroke={brand.border} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            fontSize={12}
            tickFormatter={(value: number) => value.toLocaleString('en-GB')}
          />
          <Tooltip
            cursor={{ fill: brand.fill }}
            formatter={(value) => [formatMoney(Number(value)), 'Contribution']}
            labelFormatter={(label, payload) =>
              `${label} · ${payload?.[0]?.payload?.policies ?? 0} policies`
            }
          />
          <Bar
            dataKey="contribution"
            fill={brand.magenta}
            radius={[3, 3, 0, 0]}
            maxBarSize={36}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Queues of the agent's own work, each linking to the filtered list. */
function useTasks(counts: Counts): WorkItem[] {
  const { can } = useAuth();
  const awaitingPayment = counts.pendingPayment + counts.outstandingCount;
  const items: (WorkItem | false)[] = [
    can(P.portalPoliciesView) && {
      key: 'drafts',
      icon: <FileTextOutlined />,
      label: 'Draft quotations to complete',
      count: counts.draft,
      to: '/portal/policies?status=DRAFT',
    },
    can(P.portalBillingView) && {
      key: 'payment',
      icon: <WalletOutlined />,
      label: 'Contributions to collect',
      meta:
        Number(counts.outstandingAmount) > 0 ? (
          <>
            <Money value={counts.outstandingAmount} /> outstanding
          </>
        ) : undefined,
      count: awaitingPayment,
      tone: 'warning',
      to: '/portal/billing',
    },
    can(P.portalPoliciesView) && {
      key: 'renewals',
      icon: <SyncOutlined />,
      label: 'Renewals due in 30 days',
      count: counts.renewalsDue,
      tone: 'warning',
      to: '/portal/renewals',
    },
    can(P.portalPoliciesView) && {
      key: 'rejected',
      icon: <CloseCircleOutlined />,
      label: 'Rejected applications',
      count: counts.rejected,
      tone: 'danger',
      to: '/portal/policies?status=REJECTED',
    },
    can(P.portalIssues) && {
      key: 'issues',
      icon: <CustomerServiceOutlined />,
      label: 'Open support issues',
      count: counts.openIssues,
      to: '/portal/issues',
    },
    {
      key: 'notifications',
      icon: <BellOutlined />,
      label: 'Unread notifications',
      count: counts.unreadNotifications,
      to: '/portal/notifications',
    },
  ];
  return items.filter((item): item is WorkItem => Boolean(item));
}

function KpiRow({ counts }: { counts: Counts }) {
  const awaitingPayment = counts.pendingPayment + counts.outstandingCount;
  return (
    <KpiGrid columns={6}>
      <KpiTile
        label="Active policies"
        icon={<FileProtectOutlined />}
        tone="accent"
        value={counts.active}
        to="/portal/policies?status=ACTIVE"
      />
      <KpiTile
        label="Draft quotations"
        icon={<FileTextOutlined />}
        value={counts.draft}
        to="/portal/policies?status=DRAFT"
      />
      <KpiTile
        label="Awaiting approval"
        icon={<AuditOutlined />}
        value={counts.pendingApproval}
        to="/portal/policies?status=PENDING_APPROVAL"
      />
      <KpiTile
        label="Awaiting payment"
        icon={<WalletOutlined />}
        value={awaitingPayment}
        sub={Number(counts.outstandingAmount) > 0 && <Money value={counts.outstandingAmount} />}
        tone={awaitingPayment > 0 ? 'warning' : 'default'}
        to="/portal/billing"
      />
      <KpiTile
        label="Overdue"
        icon={<ExclamationCircleOutlined />}
        value={counts.overdue}
        sub="Past due date"
        tone={counts.overdue > 0 ? 'danger' : 'default'}
        to="/portal/billing"
      />
      <KpiTile
        label="Renewals due"
        icon={<SyncOutlined />}
        value={counts.renewalsDue}
        sub="Next 30 days"
        tone={counts.renewalsDue > 0 ? 'warning' : 'default'}
        to="/portal/renewals"
      />
    </KpiGrid>
  );
}

function RecentActivity({ rows }: { rows: Activity[] }) {
  const navigate = useNavigate();
  return (
    <DataTable<Activity>
      rowKey="id"
      size="small"
      pagination={false}
      dataSource={rows.slice(0, RECENT_ROWS)}
      onRowClick={(row) => navigate(`/portal/policies/${row.policyId}`)}
      scroll={{}}
      locale={{ emptyText: 'No activity yet' }}
      columns={[
        dateTimeColumn('When', 'createdAt', 150),
        {
          title: 'Reference',
          dataIndex: 'reference',
          width: 140,
          render: (reference: string, row) => (
            <Link to={`/portal/policies/${row.policyId}`}>{reference}</Link>
          ),
        },
        { title: 'Activity', dataIndex: 'action', width: 150, render: humanise },
        textColumn('Details', 'remarks'),
        textColumn('By', 'actorName', 170),
      ]}
    />
  );
}

function DashboardView({ dashboard }: { dashboard: PortalDashboard }) {
  const { profile, counts, pendingActions, monthly, recentActivity } = dashboard;
  const tasks = useTasks(counts);
  return (
    <>
      <PageHeader
        title="Dashboard"
        breadcrumb={[{ title: 'Home' }]}
        meta={[
          { label: 'Code', value: profile.agentCode },
          { label: 'Type', value: AGENT_TYPE_LABELS[profile.agentType] },
          { label: 'Agency / bank', value: profile.agency.name },
          profile.reportsTo && { label: 'Reports to', value: profile.reportsTo },
        ]}
      />

      {profile.agency.issuanceBlocked && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="New business blocked for your agency"
          description={profile.agency.issuanceBlockReason}
          action={
            <Link to="/portal/billing">
              <Button size="small">Go to billing</Button>
            </Link>
          }
        />
      )}

      <KpiRow counts={counts} />

      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Card
            title="Production"
            extra={<span className="muted">Last 6 months</span>}
            className="content-card"
          >
            <ProductionChart monthly={monthly} />
          </Card>
          <Card
            title="Recent activity"
            extra={<Link to="/portal/policies">All policies</Link>}
            className="content-card content-card--flush"
          >
            <RecentActivity rows={recentActivity} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="My tasks" className="content-card content-card--flush">
            <WorkQueue items={tasks} emptyLabel="No tasks" />
          </Card>
          <Card title="Follow-ups" className="content-card content-card--flush">
            <WorkQueue
              emptyLabel="No follow-ups"
              items={pendingActions.map((action) => ({
                key: `${action.type}-${action.link}`,
                icon: <ExclamationCircleOutlined />,
                label: action.title,
                meta: action.detail,
                to: action.link,
              }))}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}

/** AP-52/53: profile, production, work queues and recent activity for the agent or bank officer. */
export default function DashboardPage() {
  const dashboard = useApiQuery<PortalDashboard>('/portal/dashboard');
  return <QueryState query={dashboard}>{(data) => <DashboardView dashboard={data} />}</QueryState>;
}
