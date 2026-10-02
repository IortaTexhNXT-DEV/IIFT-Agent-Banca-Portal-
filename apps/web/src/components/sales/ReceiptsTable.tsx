import { Table } from 'antd';
import type { IsoDate, Money as MoneyValue } from '../../api/types';
import { formatDateTime } from '../../utils/format';
import { Money } from '../Money';
import { DocumentDownloadButton } from './DocumentDownloadButton';

interface ReceiptRow {
  id: string;
  receiptNo: string;
  amount: MoneyValue;
  issuedAt: IsoDate;
  documentId: string | null;
}

/** e-Receipts issued after payment verification (AP-41/44), each downloadable as PDF. */
export function ReceiptsTable({ receipts }: { receipts: ReceiptRow[] }) {
  return (
    <Table<ReceiptRow>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={receipts}
      locale={{ emptyText: 'No receipts issued yet' }}
      columns={[
        { title: 'Receipt no.', dataIndex: 'receiptNo' },
        { title: 'Issued', dataIndex: 'issuedAt', render: formatDateTime },
        {
          title: 'Amount',
          dataIndex: 'amount',
          align: 'right',
          render: (value: MoneyValue) => <Money value={value} />,
        },
        {
          key: 'download',
          width: 56,
          render: (_, receipt) =>
            receipt.documentId && (
              <DocumentDownloadButton
                documentId={receipt.documentId}
                label={`receipt ${receipt.receiptNo}`}
              />
            ),
        },
      ]}
    />
  );
}
