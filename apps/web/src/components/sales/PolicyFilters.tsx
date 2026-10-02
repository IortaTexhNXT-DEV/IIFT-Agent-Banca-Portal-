import { DatePicker, Input, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import { useApiQuery } from '../../api/hooks';
import type { AgencyOption } from '../../api/sales-types';
import type { PolicyPaymentStatus, PolicyStatus, Product } from '../../api/types';
import { FilterBar } from '../FilterBar';
import { ISO_DATE, POLICY_PAYMENT_STATUS_OPTIONS, POLICY_STATUS_OPTIONS } from './options';

export interface PolicyFilterValues {
  search?: string;
  status?: PolicyStatus;
  paymentStatus?: PolicyPaymentStatus;
  productId?: string;
  agencyId?: string;
  created?: [Dayjs, Dayjs] | null;
}

/** Query parameters of GET /portal/policies and /backoffice/policies. */
export function policyQuery({ created, ...filters }: PolicyFilterValues) {
  return { ...filters, from: created?.[0].format(ISO_DATE), to: created?.[1].format(ISO_DATE) };
}

/** Initial filters from the URL, e.g. dashboard links to /portal/policies?status=DRAFT. */
export function filtersFromUrl(params: URLSearchParams): PolicyFilterValues {
  const status = POLICY_STATUS_OPTIONS.find((option) => option.value === params.get('status'))?.value;
  return { status };
}

interface Props {
  value: PolicyFilterValues;
  onChange(value: PolicyFilterValues): void;
  /** Back-office only: filter by agency or bank. */
  showAgency?: boolean;
}

/** AP-21/22: search and filter quotations and policies. */
export function PolicyFilters({ value, onChange, showAgency = false }: Props) {
  const products = useApiQuery<Product[]>('/common/products');
  const agencies = useApiQuery<AgencyOption[]>(showAgency ? '/backoffice/agencies/options' : null);
  const set = (patch: Partial<PolicyFilterValues>) => onChange({ ...value, ...patch });

  return (
    <FilterBar>
      <Input.Search
        placeholder="Policy / quotation no. or participant"
        aria-label="Search policies"
        allowClear
        defaultValue={value.search}
        onSearch={(search) => set({ search: search.trim() || undefined })}
        className="filter-search"
      />
      <Select
        placeholder="Status"
        aria-label="Status"
        allowClear
        value={value.status}
        options={POLICY_STATUS_OPTIONS}
        onChange={(status) => set({ status })}
        className="filter-select"
      />
      <Select
        placeholder="Payment status"
        aria-label="Payment status"
        allowClear
        value={value.paymentStatus}
        options={POLICY_PAYMENT_STATUS_OPTIONS}
        onChange={(paymentStatus) => set({ paymentStatus })}
        className="filter-select"
      />
      <Select
        placeholder="Product"
        aria-label="Product"
        allowClear
        showSearch={{ optionFilterProp: 'label' }}
        value={value.productId}
        loading={products.isLoading}
        options={(products.data ?? []).map((product) => ({ value: product.id, label: product.name }))}
        onChange={(productId) => set({ productId })}
        className="filter-select filter-select--wide"
      />
      {showAgency && (
        <Select
          placeholder="Agency / bank"
          aria-label="Agency or bank"
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          value={value.agencyId}
          loading={agencies.isLoading}
          options={(agencies.data ?? []).map((agency) => ({ value: agency.id, label: agency.name }))}
          onChange={(agencyId) => set({ agencyId })}
          className="filter-select filter-select--wide"
        />
      )}
      <DatePicker.RangePicker
        aria-label="Created between"
        placeholder={['Created from', 'Created to']}
        value={value.created}
        onChange={(created) => set({ created: created?.[0] && created[1] ? [created[0], created[1]] : null })}
        className="filter-range"
      />
    </FilterBar>
  );
}
