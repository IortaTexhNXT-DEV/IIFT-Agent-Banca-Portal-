import { ClockCircleOutlined, DollarOutlined, PercentageOutlined } from '@ant-design/icons';
import { DatePicker } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { usePagedQuery } from '../../api/hooks';
import type { Commission, CommissionPage as CommissionResult } from '../../api/sales-types';
import { useAuth } from '../../auth/AuthContext';
import {
  DataTable,
  dateColumn,
  moneyColumn,
  statusColumn,
  textColumn,
} from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { KpiGrid, KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { formatMoney } from '../../utils/format';
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
  const accrued = Number(totals.ACCRUED ?? 0);
  const paid = Number(totals.PAID ?? 0);
  const periodLabel = period ? period.format('MMM YYYY') : 'All periods';

  return (
    <>
      <PageHeader
        title="Commission"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Commission' }]}
      />
      <KpiGrid columns={3}>
        <KpiTile
          label="Accrued"
          icon={<ClockCircleOutlined />}
          value={formatMoney(accrued)}
          sub="Not yet paid"
          tone="warning"
        />
        <KpiTile
          label="Paid"
          icon={<DollarOutlined />}
          value={formatMoney(paid)}
          sub={periodLabel}
        />
        <KpiTile
          label="Total"
          icon={<PercentageOutlined />}
          value={formatMoney(accrued + paid)}
          sub={`${commissions.pagination.total} ${commissions.pagination.total === 1 ? 'record' : 'records'}`}
        />
      </KpiGrid>
      <TableCard
        toolbar={
          <DatePicker
            picker="month"
            aria-label="Period"
            placeholder="All periods"
            format="MMM YYYY"
            value={period}
            className="filter-select"
            onChange={(value) => {
              setPeriod(value);
              commissions.resetPage();
            }}
          />
        }
      >
        <DataTable<Commission>
          rowKey="id"
          loading={commissions.isFetching}
          dataSource={commissions.items}
          pagination={commissions.pagination}
          scroll={{}}
          locale={{ emptyText: <EmptyState label="No commission yet" /> }}
          columns={[
            {
              title: 'Period',
              dataIndex: 'period',
              width: 100,
              render: (value: string) => dayjs(`${value}-01`).format('MMM YYYY'),
            },
            { title: 'Policy no.', dataIndex: ['policy', 'policyNo'], width: 165 },
            textColumn('Product', ['policy', 'product', 'name']),
            ...(can(P.portalAgencyWideView)
              ? [textColumn<Commission>('Agent', ['agent', 'fullName'], 160)]
              : []),
            moneyColumn('Contribution', 'contribution', 120),
            {
              title: 'Rate',
              dataIndex: 'rate',
              width: 80,
              align: 'right',
              render: (rate: string) => `${Math.round(Number(rate) * 10000) / 100}%`,
            },
            moneyColumn('Commission', 'amount', 120),
            statusColumn('Status', 'status', 110),
            dateColumn('Paid on', 'paidAt', 120),
          ]}
        />
      </TableCard>
    </>
  );
}
