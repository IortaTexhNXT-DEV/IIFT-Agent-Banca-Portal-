import { Alert, App, Button, Card, Col, Flex, Row, Table, Tabs, Tag, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { Money as MoneyValue, OutstandingPolicy, OutstandingResponse, Payment } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatCard } from '../../components/StatCard';
import { StatusTag } from '../../components/StatusTag';
import { PaymentDrawer } from '../../components/sales/PaymentDrawer';
import { PaymentList } from '../../components/sales/PaymentList';
import { PolicyLink } from '../../components/sales/PolicyTable';
import { formatDate, formatMoney } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

function Summary({ summary }: { summary: OutstandingResponse['summary'] }) {
  return (
    <>
      {summary.issuanceBlocked && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="New business is blocked for your agency"
          description={`${summary.blockReason ?? 'Contribution payments are overdue.'} Submit the overdue payments below; issuance resumes once they are received.`}
        />
      )}
      <Row gutter={[16, 16]} className="mb-16">
        <Col xs={12} xl={6}>
          <StatCard label="Outstanding" value={formatMoney(summary.outstandingAmount)} hint={`${summary.outstandingCount} policies awaiting payment`} tone="warning" />
        </Col>
        <Col xs={12} xl={6}>
          <StatCard label="Overdue" value={summary.overdueCount} hint={`${formatMoney(summary.overdueAmount)} past the due date`} tone={summary.overdueCount > 0 ? 'danger' : 'default'} />
        </Col>
        <Col xs={12} xl={6}>
          <StatCard label="Due within 3 days" value={summary.dueSoonCount} tone={summary.dueSoonCount > 0 ? 'warning' : 'default'} />
        </Col>
        <Col xs={12} xl={6}>
          <StatCard label="Pending verification" value={summary.pendingVerificationCount} hint="Payments submitted, awaiting Finance" />
        </Col>
      </Row>
    </>
  );
}

function OutstandingTable({ policies, canSubmit }: { policies: OutstandingPolicy[]; canSubmit: boolean }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { can } = useAuth();
  const [selected, setSelected] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);
  const chosen = policies.filter((policy) => selected.includes(policy.id));
  const selectedTotal = chosen.reduce((sum, policy) => sum + Number(policy.outstandingAmount), 0);

  const submitted = (payment: Payment) => {
    message.success(`Payment ${payment.paymentNo} submitted for verification`);
    setPaying(false);
    setSelected([]);
    navigate(`/portal/billing/payments/${payment.id}`);
  };

  return (
    <>
      {canSubmit && (
        <Flex justify="space-between" align="center" gap={12} wrap className="mb-16">
          <Typography.Text type="secondary">
            {chosen.length > 0 ? (
              <>
                {chosen.length} selected · <Money value={selectedTotal} strong />
              </>
            ) : (
              'Select the policies covered by one bank transfer or cheque'
            )}
          </Typography.Text>
          <Button type="primary" disabled={chosen.length === 0} onClick={() => setPaying(true)}>
            Submit payment
          </Button>
        </Flex>
      )}
      <Table<OutstandingPolicy>
        size="middle"
        rowKey="id"
        dataSource={policies}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No outstanding contributions' }}
        rowSelection={
          canSubmit
            ? {
                selectedRowKeys: selected,
                onChange: (keys) => setSelected(keys.map(String)),
                getCheckboxProps: (policy) => ({ disabled: policy.paymentStatus !== 'UNPAID', 'aria-label': `Select ${policy.policyNo ?? policy.quotationNo}` }),
              }
            : undefined
        }
        columns={[
          { title: 'Policy / quotation no.', key: 'reference', render: (_, policy) => <PolicyLink policy={policy} /> },
          { title: 'Product', dataIndex: ['product', 'name'] },
          { title: 'Participant', dataIndex: ['participant', 'fullName'] },
          ...(can(P.portalAgencyWideView) ? [{ title: 'Agent', dataIndex: ['agent', 'fullName'] }] : []),
          { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
          { title: 'Payment', dataIndex: 'paymentStatus', render: (status: string) => <StatusTag status={status} /> },
          {
            title: 'Due date',
            dataIndex: 'paymentDueDate',
            render: (date: string | null, policy) =>
              policy.overdue ? (
                <Tag color="red" variant="filled">
                  Overdue since {formatDate(date)}
                </Tag>
              ) : (
                formatDate(date)
              ),
          },
          { title: 'Contribution', dataIndex: 'contribution', align: 'right', render: (value: MoneyValue) => <Money value={value} /> },
          { title: 'Outstanding', dataIndex: 'outstandingAmount', align: 'right', render: (value: MoneyValue) => <Money value={value} strong /> },
        ]}
      />
      {paying && <PaymentDrawer policies={chosen} onClose={() => setPaying(false)} onSubmitted={submitted} />}
    </>
  );
}

/** AP-37..42: outstanding contributions, single or bulk payment with proof, and payment history. */
export default function BillingPage() {
  const { can } = useAuth();
  const outstanding = useApiQuery<OutstandingResponse>('/portal/billing/outstanding');

  return (
    <>
      <PageHeader title="Billing & payments" subtitle="Contributions awaiting payment and payments submitted to IIFT" breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Billing & payments' }]} />
      <QueryState query={outstanding}>
        {({ summary, policies }) => (
          <>
            <Summary summary={summary} />
            <Tabs
              items={[
                {
                  key: 'outstanding',
                  label: `Outstanding (${policies.length})`,
                  children: (
                    <Card className="content-card">
                      <OutstandingTable policies={policies} canSubmit={can(P.portalBillingSubmit)} />
                    </Card>
                  ),
                },
                { key: 'payments', label: 'Payment history', children: <PaymentList path="/portal/billing/payments" /> },
              ]}
            />
          </>
        )}
      </QueryState>
    </>
  );
}
