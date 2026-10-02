import type { TablePaginationConfig } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router';
import type { PolicySummary } from '../../api/types';
import { DataTable, dateColumn, moneyColumn, statusColumn, textColumn } from '../DataTable';
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

/** AP-21..23: quotations and policies with their workflow and payment status. */
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
      title: 'Policy / quotation no.',
      key: 'reference',
      fixed: 'left',
      width: 170,
      render: (_, policy) => <PolicyLink policy={policy} />,
    },
    textColumn('Product', ['product', 'name'], 200),
    textColumn('Participant', ['participant', 'fullName'], 200),
    ...(showAgent ? [textColumn<PolicySummary>('Agent', ['agent', 'fullName'], 180)] : []),
    ...(showAgency ? [textColumn<PolicySummary>('Agency / bank', ['agency', 'name'], 200)] : []),
    statusColumn('Status', 'status', 140),
    statusColumn('Payment', 'paymentStatus', 160),
    moneyColumn('Contribution', 'contribution'),
    moneyColumn('Outstanding', 'outstandingAmount'),
    dateColumn('Created', 'createdAt'),
    dateColumn('Issued', 'issuedAt'),
  ];

  return (
    <DataTable<PolicySummary>
      rowKey="id"
      loading={loading}
      dataSource={policies}
      columns={columns}
      pagination={pagination}
      onRowClick={(policy) => navigate(links.policy(policy.id))}
      locale={{ emptyText: 'No quotations or policies match the filters' }}
    />
  );
}
