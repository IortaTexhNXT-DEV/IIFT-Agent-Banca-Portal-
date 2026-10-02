import { ClockCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { Card, DatePicker, Table } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { usePagedQuery } from '../../api/hooks';
import type { Commission, CommissionPage as CommissionResult } from '../../api/sales-types';
import type { Money as MoneyValue } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { FilterBar } from '../../components/FilterBar';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { KpiGrid, KpiTile } from '../../components/KpiTile';
import { StatusTag } from '../../components/StatusTag';
import { formatDate, formatMoney } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

/** INT-05: commission and referral fees accrued on issued policies and paid through the finance system. */
export default function CommissionPage() {
  const { can } = useAuth();
  const [period, setPeriod] = useState<Dayjs | null>(null);
  const commissions = usePagedQuery<Commission>('/portal/billing/commissions', {
    period: period?.format('YYYY-MM'),
  });
  // The commission endpoint adds per-status totals for the whole filter to the usual page.
  const totals = (commissions.data as CommissionResult | undefined)?.totals ?? {};

  return (
    <>
      <PageHeader
        title="Commission"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Commission' }]}
      />
      <FilterBar>
        <DatePicker
          picker="month"
          aria-label="Period"
          placeholder="All periods"
          format="MMM YYYY"
          value={period}
          onChange={(value) => {
            setPeriod(value);
            commissions.resetPage();
          }}
        />
      </FilterBar>
      <KpiGrid columns={4}>
        <KpiTile
          label="Accrued, not yet paid"
          icon={<ClockCircleOutlined />}
          value={formatMoney(totals.ACCRUED ?? 0)}
          tone="warning"
        />
        <KpiTile label="Paid" icon={<DollarOutlined />} value={formatMoney(totals.PAID ?? 0)} />
      </KpiGrid>
      <Card className="content-card" styles={{ body: { padding: 0 } }}>
        <Table<Commission>
          size="middle"
          rowKey="id"
          loading={commissions.isFetching}
          dataSource={commissions.items}
          pagination={commissions.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No commission for this period' }}
          columns={[
            {
              title: 'Period',
              dataIndex: 'period',
              render: (value: string) => dayjs(`${value}-01`).format('MMM YYYY'),
            },
            { title: 'Policy no.', dataIndex: ['policy', 'policyNo'] },
            { title: 'Product', dataIndex: ['policy', 'product', 'name'] },
            ...(can(P.portalAgencyWideView)
              ? [{ title: 'Agent', dataIndex: ['agent', 'fullName'] }]
              : []),
            {
              title: 'Contribution',
              dataIndex: 'contribution',
              align: 'right',
              render: (value: MoneyValue) => <Money value={value} />,
            },
            {
              title: 'Rate',
              dataIndex: 'rate',
              align: 'right',
              render: (rate: string) => `${Math.round(Number(rate) * 10000) / 100}%`,
            },
            {
              title: 'Commission',
              dataIndex: 'amount',
              align: 'right',
              render: (value: MoneyValue) => <Money value={value} strong />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status: string) => <StatusTag status={status} />,
            },
            { title: 'Paid on', dataIndex: 'paidAt', render: formatDate },
          ]}
        />
      </Card>
    </>
  );
}
