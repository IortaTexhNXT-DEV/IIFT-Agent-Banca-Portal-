import { Table, type TablePaginationConfig } from 'antd';
import { Link } from 'react-router';
import type { ApprovalRequest } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';

interface Props {
  items: ApprovalRequest[];
  loading?: boolean;
  pagination?: TablePaginationConfig | false;
  /** Shown for searches across decided requests; the inbox only holds pending ones. */
  showStatus?: boolean;
  emptyText?: string;
  /** Narrow layout for dashboards: no maker or level columns. */
  compact?: boolean;
}

/** BO-16..21: approval requests with their maker, amount and current level. */
export function ApprovalTable({ items, loading, pagination = false, showStatus = false, emptyText = 'No requests', compact = false }: Props) {
  return (
    <Table<ApprovalRequest>
      size={compact ? 'small' : 'middle'}
      rowKey="id"
      loading={loading}
      dataSource={items}
      pagination={pagination}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText }}
      columns={[
        { title: 'Request no.', dataIndex: 'requestNo', render: (no: string, row) => <Link to={`/backoffice/approvals/${row.id}`}>{no}</Link> },
        { title: 'Type', dataIndex: 'type', render: humanise },
        { title: 'Summary', dataIndex: 'summary', width: compact ? 300 : 380, ellipsis: true },
        { title: 'Amount', dataIndex: 'amount', align: 'right', render: (amount: string | null) => (amount === null ? '–' : <Money value={amount} />) },
        ...(compact
          ? []
          : [
              { title: 'Submitted by', dataIndex: 'makerName' },
              {
                title: 'Level',
                key: 'level',
                render: (_: unknown, row: ApprovalRequest) => (row.status === 'PENDING' ? `${row.currentLevel} of ${row.totalLevels}` : row.totalLevels),
              },
            ]),
        { title: 'Submitted', dataIndex: 'submittedAt', render: formatDateTime },
        ...(showStatus ? [{ title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> }] : []),
      ]}
    />
  );
}
