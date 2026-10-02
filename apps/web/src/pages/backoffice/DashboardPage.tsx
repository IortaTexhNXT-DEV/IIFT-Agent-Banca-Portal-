import { Card, Col, Row, Table } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { BackofficeDashboard, Channel } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ApprovalTable } from '../../components/admin/ApprovalTable';
import { CHANNEL_LABELS } from '../../components/admin/agents';
import { ProductionTrend } from '../../components/admin/ProductionTrend';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatCard } from '../../components/StatCard';
import { formatDateTime, formatMoney, formatNumber, humanise } from '../../utils/format';
import { APPROVE_PERMISSIONS, P } from '../../utils/permissions';

type Pending = BackofficeDashboard['pending'];
type Kpis = NonNullable<BackofficeDashboard['kpis']>;

interface Tile {
  key: string;
  visible: boolean;
  label: string;
  value: ReactNode;
  to: string;
  hint?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
}

function TileRow({ tiles }: { tiles: Tile[] }) {
  return (
    <Row gutter={[16, 16]} className="mb-16">
      {tiles
        .filter((tile) => tile.visible)
        .map((tile) => (
          <Col key={tile.key} xs={12} md={8} xl={6}>
            <StatCard label={tile.label} value={tile.value} hint={tile.hint} to={tile.to} tone={tile.tone} />
          </Col>
        ))}
    </Row>
  );
}

/** BO-21: work waiting for the signed-in user, each tile linking to its queue. */
function PendingTiles({ pending }: { pending: Pending }) {
  const { can } = useAuth();
  const warnIf = (count: number) => (count > 0 ? 'warning' : 'default');
  return (
    <TileRow
      tiles={[
        { key: 'approvals', visible: APPROVE_PERMISSIONS.some(can), label: 'Awaiting my approval', value: pending.myApprovals, to: '/backoffice/approvals', tone: warnIf(pending.myApprovals) },
        { key: 'agents', visible: can(P.boAgentsView), label: 'Agent registrations pending', value: pending.pendingAgents, to: '/backoffice/agents?status=PENDING' },
        { key: 'aml', visible: can(P.boAmlReview), label: 'AML cases to review', value: pending.amlReview, to: '/backoffice/aml', tone: warnIf(pending.amlReview) },
        { key: 'documents', visible: can(P.boDocumentsVerify), label: 'Documents to verify', value: pending.documentsToVerify, to: '/backoffice/documents' },
        {
          key: 'payments',
          visible: can(P.boPaymentsView),
          label: 'Payments to verify',
          value: pending.paymentsPending,
          hint: <Money value={pending.paymentsPendingAmount} />,
          to: '/backoffice/payments?status=PENDING_VERIFICATION',
        },
        { key: 'claims', visible: can(P.boClaimsManage), label: 'Open claims', value: pending.claimsOpen, to: '/backoffice/claims' },
        {
          key: 'issues',
          visible: can(P.boIssuesManage),
          label: 'Open issues',
          value: pending.issuesOpen,
          hint: pending.issuesBreached > 0 ? `${pending.issuesBreached} past SLA` : 'All within SLA',
          to: pending.issuesBreached > 0 ? '/backoffice/issues?breached=true' : '/backoffice/issues',
          tone: pending.issuesBreached > 0 ? 'danger' : 'default',
        },
        {
          key: 'integration',
          visible: can(P.boIntegrationManage),
          label: 'Integration dead letters',
          value: pending.integrationDead,
          to: '/backoffice/integration',
          tone: pending.integrationDead > 0 ? 'danger' : 'default',
        },
      ]}
    />
  );
}

/** BO-20: management KPIs for the month and year to date. */
function KpiTiles({ kpis }: { kpis: Kpis }) {
  return (
    <TileRow
      tiles={[
        { key: 'mtd', visible: true, label: 'Policies issued this month', value: formatNumber(kpis.policiesMtd), hint: <Money value={kpis.contributionMtd} />, to: '/backoffice/policies' },
        { key: 'ytd', visible: true, label: 'Policies issued this year', value: formatNumber(kpis.policiesYtd), hint: <Money value={kpis.contributionYtd} />, to: '/backoffice/policies' },
        { key: 'agents', visible: true, label: 'Active agents and officers', value: formatNumber(kpis.activeAgents), hint: `${formatNumber(kpis.activeAgencies)} active agencies and banks`, to: '/backoffice/agents?status=ACTIVE' },
        {
          key: 'outstanding',
          visible: true,
          label: 'Outstanding contribution',
          value: formatMoney(kpis.outstandingAmount),
          hint: `${formatMoney(kpis.overdueAmount)} overdue on ${formatNumber(kpis.overdueCount)} policies`,
          to: '/backoffice/payments',
          tone: kpis.overdueCount > 0 ? 'warning' : 'default',
        },
      ]}
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
      locale={{ emptyText: 'No policies issued this year' }}
      columns={[
        { title: 'Channel', dataIndex: 'channel', render: (channel: Channel) => CHANNEL_LABELS[channel] },
        { title: 'Policies', dataIndex: 'policies', align: 'right', render: formatNumber },
        { title: 'Contribution', dataIndex: 'contribution', align: 'right', render: (value: string) => <Money value={value} /> },
        { title: 'Share', key: 'share', align: 'right', render: (_: unknown, row) => (total > 0 ? `${Math.round((Number(row.contribution) / total) * 100)}%` : '–') },
      ]}
    />
  );
}

function ManagementPanels({ dashboard }: { dashboard: BackofficeDashboard }) {
  return (
    <>
      <Row gutter={16}>
        <Col xs={24} xl={14}>
          <Card title="Production – last 12 months" className="content-card">
            <ProductionTrend points={dashboard.trend ?? []} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Production by product – year to date" className="content-card">
            <Table
              size="small"
              rowKey="code"
              pagination={false}
              dataSource={dashboard.byProduct ?? []}
              columns={[
                { title: 'Code', dataIndex: 'code', width: 80 },
                { title: 'Product', dataIndex: 'name', ellipsis: true },
                { title: 'Policies', dataIndex: 'policies', align: 'right', width: 90, render: formatNumber },
                { title: 'Contribution', dataIndex: 'contribution', align: 'right', width: 140, render: (value: string) => <Money value={value} /> },
              ]}
            />
          </Card>
          <Card title="By channel – year to date" className="content-card">
            <ChannelSplit rows={dashboard.byChannel ?? []} />
          </Card>
        </Col>
      </Row>
      <Card title="Agencies and banks blocked from new business" className="content-card">
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={dashboard.blockedAgencies ?? []}
          locale={{ emptyText: 'No agency or bank is blocked' }}
          columns={[
            { title: 'Code', dataIndex: 'code', width: 120, render: (code: string, row) => <Link to={`/backoffice/agencies/${row.id}`}>{code}</Link> },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Blocked since', dataIndex: 'issuanceBlockedAt', width: 180, render: formatDateTime },
            { title: 'Reason', dataIndex: 'issuanceBlockReason', ellipsis: true },
          ]}
        />
      </Card>
    </>
  );
}

/** BO-20/21: pending actions for every back-office user, plus management KPIs where permitted. */
export default function DashboardPage() {
  const { user, can } = useAuth();
  const dashboard = useApiQuery<BackofficeDashboard>('/backoffice/dashboard');

  return (
    <>
      <PageHeader title="Dashboard" subtitle={user ? `Welcome, ${user.fullName}` : undefined} />
      <QueryState query={dashboard}>
        {(data) => (
          <>
            <PendingTiles pending={data.pending} />
            {APPROVE_PERMISSIONS.some(can) && (
              <Row gutter={16}>
                <Col xs={24} xl={17}>
                  <Card title="Awaiting my approval" extra={<Link to="/backoffice/approvals">Open inbox</Link>} className="content-card">
                    <ApprovalTable items={data.pending.myApprovalItems} compact emptyText="Nothing is waiting for your approval" />
                  </Card>
                </Col>
                <Col xs={24} xl={7}>
                  <Card title="All pending requests by type" className="content-card">
                    <Table
                      size="small"
                      rowKey="type"
                      pagination={false}
                      showHeader={false}
                      locale={{ emptyText: 'No pending requests' }}
                      dataSource={Object.entries(data.pending.pendingByType).map(([type, count]) => ({ type, count }))}
                      columns={[
                        { dataIndex: 'type', render: humanise },
                        { dataIndex: 'count', align: 'right', width: 60 },
                      ]}
                    />
                  </Card>
                </Col>
              </Row>
            )}
            {data.kpis && (
              <>
                <KpiTiles kpis={data.kpis} />
                <ManagementPanels dashboard={data} />
              </>
            )}
          </>
        )}
      </QueryState>
    </>
  );
}
