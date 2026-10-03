import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  SafetyCertificateOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, Tabs, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { OutstandingPolicy, OutstandingResponse, Payment } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { DataTable, moneyColumn, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { KpiGrid, KpiTile } from '../../components/KpiTile';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { PaymentDrawer } from '../../components/sales/PaymentDrawer';
import { PaymentList } from '../../components/sales/PaymentList';
import { PolicyLink } from '../../components/sales/PolicyTable';
import { useSalesLinks } from '../../components/sales/useSalesLinks';
import { TableCard } from '../../components/TableCard';
import { formatDate, formatMoney } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

type Summary = OutstandingResponse['summary'];

function payable(policy: OutstandingPolicy): boolean {
  return policy.paymentStatus === 'UNPAID';
}

function Tiles({ summary }: { summary: Summary }) {
  return (
    <KpiGrid columns={4}>
      <KpiTile
        label="Outstanding"
        icon={<WalletOutlined />}
        value={formatMoney(summary.outstandingAmount)}
        sub={`${summary.outstandingCount} ${summary.outstandingCount === 1 ? 'policy' : 'policies'}`}
        tone="warning"
      />
      <KpiTile
        label="Overdue"
        icon={<ExclamationCircleOutlined />}
        value={summary.overdueCount}
        sub={`${formatMoney(summary.overdueAmount)} past due`}
        tone={summary.overdueCount > 0 ? 'danger' : 'default'}
      />
      <KpiTile
        label="Due within 3 days"
        icon={<ClockCircleOutlined />}
        value={summary.dueSoonCount}
        tone={summary.dueSoonCount > 0 ? 'warning' : 'default'}
      />
      <KpiTile
        label="Pending verification"
        icon={<SafetyCertificateOutlined />}
        value={summary.pendingVerificationCount}
        sub="Awaiting Finance"
      />
    </KpiGrid>
  );
}

function DueDate({ policy }: { policy: OutstandingPolicy }) {
  const date = formatDate(policy.paymentDueDate);
  if (!policy.overdue) return <>{date}</>;
  return (
    <Tooltip title="Overdue">
      <Typography.Text type="danger" strong>
        {date}
      </Typography.Text>
    </Tooltip>
  );
}

interface TableProps {
  policies: OutstandingPolicy[];
  canSubmit: boolean;
  selected: string[];
  onSelect(ids: string[]): void;
  onPay(): void;
}

function OutstandingTable({ policies, canSubmit, selected, onSelect, onPay }: TableProps) {
  const navigate = useNavigate();
  const links = useSalesLinks();
  const { can } = useAuth();
  const chosen = policies.filter((policy) => selected.includes(policy.id));
  const selectedTotal = chosen.reduce((sum, policy) => sum + Number(policy.outstandingAmount), 0);

  return (
    <TableCard
      toolbar={
        canSubmit && (
          <span className="muted">
            {chosen.length > 0 ? (
              <>
                {chosen.length} selected · <Money value={selectedTotal} strong />
              </>
            ) : (
              '0 selected'
            )}
          </span>
        )
      }
      actions={
        canSubmit && (
          <Button type="primary" disabled={chosen.length === 0} onClick={onPay}>
            Submit payment
          </Button>
        )
      }
    >
      <DataTable<OutstandingPolicy>
        rowKey="id"
        dataSource={policies}
        pagination={false}
        scroll={{}}
        onRowClick={(policy) => navigate(links.policy(policy.id))}
        locale={{ emptyText: <EmptyState label="No outstanding contributions" /> }}
        rowSelection={
          canSubmit
            ? {
                selectedRowKeys: selected,
                onChange: (keys) => onSelect(keys.map(String)),
                getCheckboxProps: (policy) => ({
                  disabled: !payable(policy),
                  'aria-label': `Select ${policy.policyNo ?? policy.quotationNo}`,
                }),
              }
            : undefined
        }
        columns={[
          {
            title: 'Policy / quotation',
            key: 'reference',
            width: 165,
            render: (_, policy) => <PolicyLink policy={policy} />,
          },
          textColumn('Product', ['product', 'name']),
          textColumn('Participant', ['participant', 'fullName'], 150),
          ...(can(P.portalAgencyWideView)
            ? [textColumn<OutstandingPolicy>('Agent', ['agent', 'fullName'], 130)]
            : []),
          statusColumn('Status', 'status', 135),
          statusColumn('Payment', 'paymentStatus', 145),
          {
            title: 'Due date',
            key: 'due',
            width: 110,
            render: (_, policy) => <DueDate policy={policy} />,
          },
          moneyColumn('Outstanding', 'outstandingAmount', 130),
        ]}
      />
    </TableCard>
  );
}

/** AP-37..42: outstanding contributions, single or bulk payment with proof, and payment history. */
export default function BillingPage() {
  const { can } = useAuth();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const outstanding = useApiQuery<OutstandingResponse>('/portal/billing/outstanding');
  const [tab, setTab] = useState('outstanding');
  const [selected, setSelected] = useState<string[]>([]);
  const [paying, setPaying] = useState(false);
  const canSubmit = can(P.portalBillingSubmit);

  const submitted = (payment: Payment) => {
    message.success(`Payment ${payment.paymentNo} submitted for verification`);
    setPaying(false);
    setSelected([]);
    navigate(`/portal/billing/payments/${payment.id}`);
  };

  return (
    <>
      <PageHeader
        title="Billing & payments"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Billing & payments' }]}
      />
      <QueryState query={outstanding}>
        {({ summary, policies }) => {
          const overdue = policies.filter((policy) => policy.overdue && payable(policy));
          const chosen = policies.filter((policy) => selected.includes(policy.id));
          const payOverdue = () => {
            setSelected(overdue.map((policy) => policy.id));
            setTab('outstanding');
            setPaying(true);
          };
          return (
            <>
              {summary.issuanceBlocked && (
                <Alert
                  className="mb-16"
                  type="error"
                  showIcon
                  title={`New business blocked: ${summary.overdueCount} contribution${summary.overdueCount === 1 ? '' : 's'} overdue`}
                  action={
                    canSubmit &&
                    overdue.length > 0 && (
                      <Button size="small" onClick={payOverdue}>
                        Pay now
                      </Button>
                    )
                  }
                />
              )}
              <Tiles summary={summary} />
              <Tabs
                className="page-tabs"
                activeKey={tab}
                onChange={setTab}
                items={[
                  {
                    key: 'outstanding',
                    label: `Outstanding (${policies.length})`,
                    children: (
                      <OutstandingTable
                        policies={policies}
                        canSubmit={canSubmit}
                        selected={selected}
                        onSelect={setSelected}
                        onPay={() => setPaying(true)}
                      />
                    ),
                  },
                  {
                    key: 'payments',
                    label: 'Payment history',
                    children: <PaymentList path="/portal/billing/payments" />,
                  },
                ]}
              />
              {paying && chosen.length > 0 && (
                <PaymentDrawer
                  policies={chosen}
                  onClose={() => setPaying(false)}
                  onSubmitted={submitted}
                />
              )}
            </>
          );
        }}
      </QueryState>
    </>
  );
}
