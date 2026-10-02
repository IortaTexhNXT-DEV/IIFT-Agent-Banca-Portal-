import { ExclamationCircleOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Row, Table, Typography } from 'antd';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Link, useNavigate } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { PortalDashboard } from '../../api/types';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatCard } from '../../components/StatCard';
import { useAuth } from '../../auth/AuthContext';
import { brand } from '../../theme/theme';
import { formatDateTime, formatMoney, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';
import dayjs from 'dayjs';

/** AP-52/53: profile, production, pending actions and recent activity for the agent or bank officer. */
export default function DashboardPage() {
  const dashboard = useApiQuery<PortalDashboard>('/portal/dashboard');
  const navigate = useNavigate();
  const { can } = useAuth();

  return (
    <QueryState query={dashboard}>
      {({ profile, counts, pendingActions, monthly, recentActivity }) => (
        <>
          <PageHeader
            title={`Welcome, ${profile.fullName}`}
            subtitle={`${profile.agentCode} · ${humanise(profile.agentType)} · ${profile.agency.name}${profile.reportsTo ? ` · reports to ${profile.reportsTo}` : ''}`}
            extra={
              can(P.portalPoliciesQuote) && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/portal/quotations/new')}
                  disabled={profile.agency.issuanceBlocked}
                >
                  New quotation
                </Button>
              )
            }
          />

          {profile.agency.issuanceBlocked && (
            <Alert
              className="mb-16"
              type="error"
              showIcon
              title="New business is blocked for your agency"
              description={
                <>
                  {profile.agency.issuanceBlockReason}{' '}
                  <Link to="/portal/billing">Submit outstanding payments</Link> to restore issuance.
                </>
              }
            />
          )}

          <Row gutter={[16, 16]} className="mb-16">
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label="Active policies"
                value={counts.active}
                to="/portal/policies?status=ACTIVE"
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label="Draft quotations"
                value={counts.draft}
                to="/portal/policies?status=DRAFT"
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label="Awaiting approval"
                value={counts.pendingApproval}
                to="/portal/policies?status=PENDING_APPROVAL"
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label="Awaiting payment"
                value={counts.pendingPayment + counts.outstandingCount}
                hint={
                  Number(counts.outstandingAmount) > 0 ? (
                    <>
                      <Money value={counts.outstandingAmount} /> outstanding
                    </>
                  ) : undefined
                }
                to="/portal/billing"
                tone="warning"
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label="Overdue contributions"
                value={counts.overdue}
                to="/portal/billing"
                tone={counts.overdue > 0 ? 'danger' : 'default'}
              />
            </Col>
            <Col xs={12} md={8} xl={4}>
              <StatCard
                label="Renewals due (30 days)"
                value={counts.renewalsDue}
                to="/portal/renewals"
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <Card title="Production – last 6 months" className="content-card">
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={monthly.map((point) => ({
                        ...point,
                        label: dayjs(`${point.month}-01`).format('MMM YY'),
                      }))}
                      margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={brand.border} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={64}
                        tickFormatter={(value: number) => `B$${value.toLocaleString('en-GB')}`}
                      />
                      <Tooltip
                        formatter={(value) => [formatMoney(Number(value)), 'Contribution']}
                        labelFormatter={(label, payload) =>
                          `${label} · ${payload?.[0]?.payload?.policies ?? 0} policies`
                        }
                      />
                      <Bar
                        dataKey="contribution"
                        fill={brand.magenta}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={42}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col xs={24} xl={10}>
              <Card title="Needs your attention" className="content-card">
                {pendingActions.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing outstanding" />
                ) : (
                  <ul className="action-list">
                    {pendingActions.map((action) => (
                      <li
                        key={`${action.type}-${action.link}`}
                        className="action-list__item clickable-row"
                        onClick={() => navigate(action.link)}
                      >
                        <ExclamationCircleOutlined
                          style={{
                            color: action.type === 'DRAFT' ? brand.muted : brand.orange,
                            marginTop: 4,
                          }}
                        />
                        <div className="action-list__body">
                          <div className="action-list__title">{action.title}</div>
                          <Typography.Text type="secondary" ellipsis>
                            {action.detail}
                          </Typography.Text>
                        </div>
                        <RightOutlined className="muted" />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Col>
          </Row>

          <Card title="Recent activity" className="content-card">
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={recentActivity}
              columns={[
                { title: 'When', dataIndex: 'createdAt', width: 180, render: formatDateTime },
                {
                  title: 'Reference',
                  dataIndex: 'reference',
                  width: 170,
                  render: (reference: string, row) => (
                    <Link to={`/portal/policies/${row.policyId}`}>{reference}</Link>
                  ),
                },
                { title: 'Activity', dataIndex: 'action', width: 200, render: humanise },
                { title: 'Details', dataIndex: 'remarks', ellipsis: true },
                { title: 'By', dataIndex: 'actorName', width: 220, ellipsis: true },
              ]}
            />
          </Card>
        </>
      )}
    </QueryState>
  );
}
