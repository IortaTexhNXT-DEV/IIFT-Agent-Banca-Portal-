import type { TablePaginationConfig } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router';
import type { PolicySummary } from '../../api/types';
import { DataTable, dateColumn, moneyColumn, statusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { policyReference } from './options';
import { useSalesLinks } from './useSalesLinks';

/** Policy or quotation number linking to the policy page of the current module. */
export function PolicyLink({
  policy,
}: {
  policy: { id: string; policyNo: string | null; quotationNo: string };
}) {
  const links = useSalesLinks();
  return <Link to={links.policy(policy.id)}>{policyReference(policy)}</Link>;
}

interface Props {
  policies: PolicySummary[];
  loading: boolean;
  pagination: TablePaginationConfig;
  showAgent?: boolean;
  showAgency?: boolean;
}

/**
 * AP-21..23: quotations and policies with their workflow and payment status.
 * Column widths add up to the card width at 1440px (names ellipsed, numbers and dates
 * fixed); the register across agencies shows the agency in place of the agent.
 */
export function PolicyTable({
  policies,
  loading,
  pagination,
  showAgent = false,
  showAgency = false,
}: Props) {
  const links = useSalesLinks();
  const navigate = useNavigate();
  const columns: ColumnsType<PolicySummary> = [
    {
      title: 'Policy / quotation',
      key: 'reference',
      width: 165,
      render: (_, policy) => <PolicyLink policy={policy} />,
    },
    textColumn('Product', ['product', 'name']),
    textColumn('Participant', ['participant', 'fullName'], 160),
    ...(showAgency
      ? [textColumn<PolicySummary>('Agency / bank', ['agency', 'name'], 150)]
      : showAgent
        ? [textColumn<PolicySummary>('Agent', ['agent', 'fullName'], 150)]
        : []),
    statusColumn('Status', 'status', 135),
    statusColumn('Payment', 'paymentStatus', 145),
    moneyColumn('Contribution', 'contribution', 120),
    dateColumn('Created', 'createdAt', 120),
  ];

  return (
    <DataTable<PolicySummary>
      rowKey="id"
      loading={loading}
      dataSource={policies}
      columns={columns}
      pagination={pagination}
      scroll={{}}
      onRowClick={(policy) => navigate(links.policy(policy.id))}
      locale={{ emptyText: <EmptyState label="No quotations or policies" /> }}
    />
  );
}
