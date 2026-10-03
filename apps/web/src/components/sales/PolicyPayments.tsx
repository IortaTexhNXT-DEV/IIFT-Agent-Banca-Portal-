import { Link } from 'react-router';
import type { PolicyDetail } from '../../api/types';
import { formatDate, humanise } from '../../utils/format';
import { DataTable, moneyColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { StatusTag } from '../StatusTag';
import { ReceiptsTable } from './ReceiptsTable';
import { useSalesLinks } from './useSalesLinks';

type Allocation = PolicyDetail['allocations'][number];

/** Payments allocated to the policy (single or bulk) and the e-Receipts issued for them. */
export function PolicyPayments({ policy }: { policy: PolicyDetail }) {
  const links = useSalesLinks();
  return (
    <>
      <h3 className="form-section__title mb-12">Payments</h3>
      <DataTable<Allocation>
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={policy.allocations}
        className="mb-16"
        scroll={{}}
        locale={{ emptyText: <EmptyState label="No payments" inline /> }}
        columns={[
          {
            title: 'Payment no.',
            key: 'paymentNo',
            width: 140,
            render: (_, row) => (
              <Link to={links.payment(row.payment.id)}>{row.payment.paymentNo}</Link>
            ),
          },
          {
            title: 'Payment date',
            key: 'paymentDate',
            width: 120,
            render: (_, row) => formatDate(row.payment.paymentDate),
          },
          {
            title: 'Method',
            key: 'method',
            width: 130,
            render: (_, row) => humanise(row.payment.method),
          },
          {
            title: 'Reference',
            key: 'referenceNo',
            ellipsis: true,
            render: (_, row) => row.payment.referenceNo,
          },
          {
            title: 'Status',
            key: 'status',
            width: 150,
            render: (_, row) => <StatusTag status={row.payment.status} />,
          },
          moneyColumn('Allocated', 'amount', 130),
        ]}
      />
      <h3 className="form-section__title mb-12">Receipts</h3>
      <ReceiptsTable receipts={policy.receipts} />
    </>
  );
}
