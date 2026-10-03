import { Input, Select } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useApiQuery, usePagedQuery } from '../../api/hooks';
import type { AgencyOption } from '../../api/sales-types';
import type { Payment, PaymentStatus } from '../../api/types';
import { humanise } from '../../utils/format';
import { DataTable, dateColumn, moneyColumn, paymentStatusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { TableCard } from '../TableCard';
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
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => paymentFiltersFromUrl(params));
  const payments = usePagedQuery<Payment>(path, filters);
  const agencies = useApiQuery<AgencyOption[]>(showAgency ? '/backoffice/agencies/options' : null);
  const set = (patch: Partial<Filters>) => {
    setFilters({ ...filters, ...patch });
    payments.resetPage();
  };

  return (
    <TableCard
      toolbar={
        <>
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
        </>
      }
    >
      <DataTable<Payment>
        rowKey="id"
        loading={payments.isFetching}
        dataSource={payments.items}
        pagination={payments.pagination}
        scroll={{}}
        onRowClick={(payment) => navigate(links.payment(payment.id))}
        locale={{ emptyText: <EmptyState label="No payments yet" /> }}
        columns={[
          {
            title: 'Payment no.',
            dataIndex: 'paymentNo',
            width: 130,
            render: (paymentNo: string, payment) => (
              <Link to={links.payment(payment.id)}>{paymentNo}</Link>
            ),
          },
          ...(showAgency ? [textColumn<Payment>('Agency / bank', ['agency', 'name'], 150)] : []),
          dateColumn('Payment date', 'paymentDate', 115),
          { title: 'Method', dataIndex: 'method', width: 115, render: humanise },
          textColumn('Bank', 'bankName'),
          textColumn('Reference', 'referenceNo', 130),
          moneyColumn('Amount', 'totalAmount', 120),
          paymentStatusColumn('Status', 'status'),
          dateColumn('Submitted', 'createdAt', 120),
        ]}
      />
    </TableCard>
  );
}
