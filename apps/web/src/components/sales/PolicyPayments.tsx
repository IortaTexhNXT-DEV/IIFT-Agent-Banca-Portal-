import { Table, Typography } from 'antd';
import { Link } from 'react-router';
import type { Money as MoneyValue, PolicyDetail } from '../../api/types';
import { formatDate, humanise } from '../../utils/format';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { ReceiptsTable } from './ReceiptsTable';
import { useSalesLinks } from './useSalesLinks';

type Allocation = PolicyDetail['allocations'][number];

/** Payments allocated to the policy (single or bulk) and the e-Receipts issued for them. */
export function PolicyPayments({ policy }: { policy: PolicyDetail }) {
  const links = useSalesLinks();
  return (
    <>
      <Typography.Title level={5}>Payments</Typography.Title>
      <Table<Allocation>
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={policy.allocations}
        className="mb-16"
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No payments submitted for this policy' }}
        columns={[
          { title: 'Payment no.', key: 'paymentNo', render: (_, row) => <Link to={links.payment(row.payment.id)}>{row.payment.paymentNo}</Link> },
          { title: 'Payment date', key: 'paymentDate', render: (_, row) => formatDate(row.payment.paymentDate) },
          { title: 'Method', key: 'method', render: (_, row) => humanise(row.payment.method) },
          { title: 'Reference', key: 'referenceNo', render: (_, row) => row.payment.referenceNo },
          { title: 'Status', key: 'status', render: (_, row) => <StatusTag status={row.payment.status} /> },
          { title: 'Allocated', dataIndex: 'amount', align: 'right', render: (value: MoneyValue) => <Money value={value} /> },
        ]}
      />
      <Typography.Title level={5}>Receipts</Typography.Title>
      <ReceiptsTable receipts={policy.receipts} />
    </>
  );
}
