import { Card, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useApiQuery, usePagedQuery } from '../../api/hooks';
import type { AgencyOption } from '../../api/sales-types';
import type { Money as MoneyValue, Payment, PaymentStatus } from '../../api/types';
import { formatDate, humanise } from '../../utils/format';
import { FilterBar } from '../FilterBar';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { PAYMENT_STATUS_OPTIONS } from './options';
import { useSalesLinks } from './useSalesLinks';

type Filters = {
  search?: string;
  status?: PaymentStatus;
  agencyId?: string;
};

/** Initial filters from the URL, e.g. the dashboard links to ?status=PENDING_VERIFICATION. */
export function paymentFiltersFromUrl(params: URLSearchParams): Filters {
  const status = PAYMENT_STATUS_OPTIONS.find(
    (option) => option.value === params.get('status'),
  )?.value;
  return { status };
}

interface Props {
  path: '/portal/billing/payments' | '/backoffice/billing/payments';
  /** Back-office: filter and show the agency or bank that paid. */
  showAgency?: boolean;
}

/** AP-37..41: submitted payments with their verification status. */
export function PaymentList({ path, showAgency = false }: Props) {
  const links = useSalesLinks();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => paymentFiltersFromUrl(params));
  const payments = usePagedQuery<Payment>(path, filters);
  const agencies = useApiQuery<AgencyOption[]>(showAgency ? '/backoffice/agencies/options' : null);
  const set = (patch: Partial<Filters>) => {
    setFilters({ ...filters, ...patch });
    payments.resetPage();
  };

  return (
    <>
      <FilterBar>
        <Input.Search
          placeholder="Payment no. or bank reference"
          aria-label="Search payments"
          allowClear
          onSearch={(search) => set({ search: search.trim() || undefined })}
          className="filter-search"
        />
        <Select
          placeholder="Status"
          aria-label="Status"
          allowClear
          options={PAYMENT_STATUS_OPTIONS}
          value={filters.status}
          onChange={(status) => set({ status })}
          className="filter-select"
        />
        {showAgency && (
          <Select
            placeholder="Agency / bank"
            aria-label="Agency or bank"
            allowClear
            showSearch={{ optionFilterProp: 'label' }}
            loading={agencies.isLoading}
            options={(agencies.data ?? []).map((agency) => ({
              value: agency.id,
              label: agency.name,
            }))}
            value={filters.agencyId}
            onChange={(agencyId) => set({ agencyId })}
            className="filter-select filter-select--wide"
          />
        )}
      </FilterBar>
      <Card className="content-card" styles={{ body: { padding: 0 } }}>
        <Table<Payment>
          size="middle"
          rowKey="id"
          loading={payments.isFetching}
          dataSource={payments.items}
          pagination={payments.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No payments found' }}
          columns={[
            {
              title: 'Payment no.',
              dataIndex: 'paymentNo',
              render: (paymentNo: string, payment) => (
                <Link to={links.payment(payment.id)}>{paymentNo}</Link>
              ),
            },
            ...(showAgency ? [{ title: 'Agency / bank', dataIndex: ['agency', 'name'] }] : []),
            { title: 'Payment date', dataIndex: 'paymentDate', render: formatDate },
            { title: 'Method', dataIndex: 'method', render: humanise },
            { title: 'Bank', dataIndex: 'bankName', render: (bank: string | null) => bank ?? '–' },
            { title: 'Reference', dataIndex: 'referenceNo' },
            {
              title: 'Policies',
              key: 'policies',
              align: 'right',
              render: (_, payment) => payment.allocations.length,
            },
            {
              title: 'Amount',
              dataIndex: 'totalAmount',
              align: 'right',
              render: (value: MoneyValue) => <Money value={value} />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status: string) => <StatusTag status={status} />,
            },
            { title: 'Submitted', dataIndex: 'createdAt', render: formatDate },
          ]}
        />
      </Card>
    </>
  );
}
