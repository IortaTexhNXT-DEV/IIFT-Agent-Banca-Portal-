import type { IsoDate, Money as MoneyValue } from '../../api/types';
import { DataTable, dateTimeColumn, moneyColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
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
    <DataTable<ReceiptRow>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={receipts}
      scroll={{}}
      locale={{ emptyText: <EmptyState label="No receipts issued" inline /> }}
      columns={[
        { title: 'Receipt no.', dataIndex: 'receiptNo' },
        dateTimeColumn('Issued', 'issuedAt', 160),
        moneyColumn('Amount', 'amount', 140),
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
