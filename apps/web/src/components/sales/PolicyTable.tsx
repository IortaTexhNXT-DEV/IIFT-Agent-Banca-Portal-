import { Table, type TablePaginationConfig } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link } from 'react-router';
import type { PolicySummary } from '../../api/types';
import { formatDate } from '../../utils/format';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { policyReference } from './options';
import { useSalesLinks } from './useSalesLinks';

/** Policy or quotation number linking to the policy page of the current module. */
export function PolicyLink({ policy }: { policy: { id: string; policyNo: string | null; quotationNo: string } }) {
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
export function PolicyTable({ policies, loading, pagination, showAgent = false, showAgency = false }: Props) {
  const columns: ColumnsType<PolicySummary> = [
    { title: 'Policy / quotation no.', key: 'reference', fixed: 'left', render: (_, policy) => <PolicyLink policy={policy} /> },
    { title: 'Product', dataIndex: ['product', 'name'] },
    { title: 'Participant', dataIndex: ['participant', 'fullName'] },
    ...(showAgent ? [{ title: 'Agent', dataIndex: ['agent', 'fullName'] }] : []),
    ...(showAgency ? [{ title: 'Agency / bank', dataIndex: ['agency', 'name'] }] : []),
    { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
    { title: 'Payment', dataIndex: 'paymentStatus', render: (status: string) => <StatusTag status={status} /> },
    { title: 'Contribution', dataIndex: 'contribution', align: 'right', render: (value: string) => <Money value={value} /> },
    { title: 'Outstanding', dataIndex: 'outstandingAmount', align: 'right', render: (value: string) => <Money value={value} /> },
    { title: 'Created', dataIndex: 'createdAt', render: formatDate },
    { title: 'Issued', dataIndex: 'issuedAt', render: formatDate },
  ];

  return (
    <Table<PolicySummary>
      size="middle"
      rowKey="id"
      loading={loading}
      dataSource={policies}
      columns={columns}
      pagination={pagination}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No quotations or policies match the filters' }}
    />
  );
}
