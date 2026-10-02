import type { TablePaginationConfig } from 'antd';
import type { ColumnType } from 'antd/es/table';
import { Link, useNavigate } from 'react-router';
import type { ApprovalRequest } from '../../api/types';
import {
  DataTable,
  dateColumn,
  dateTimeColumn,
  moneyColumn,
  statusColumn,
  textColumn,
} from '../DataTable';
import { humanise } from '../../utils/format';

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
export function ApprovalTable({
  items,
  loading,
  pagination = false,
  showStatus = false,
  emptyText = 'No requests',
  compact = false,
}: Props) {
  const navigate = useNavigate();
  const columns: ColumnType<ApprovalRequest>[] = [
    {
      title: 'Request no.',
      dataIndex: 'requestNo',
      width: 130,
      render: (no: string, row) => <Link to={`/backoffice/approvals/${row.id}`}>{no}</Link>,
    },
    { title: 'Type', dataIndex: 'type', width: 170, render: humanise },
    compact ? textColumn('Summary', 'summary') : textColumn('Summary', 'summary', 320),
    moneyColumn('Amount', 'amount', 130),
  ];
  if (!compact) {
    columns.push(textColumn('Submitted by', 'makerName', 180), {
      title: 'Level',
      key: 'level',
      width: 80,
      render: (_: unknown, row) =>
        row.status === 'PENDING' ? `${row.currentLevel} of ${row.totalLevels}` : row.totalLevels,
    });
  }
  columns.push(
    compact ? dateColumn('Submitted', 'submittedAt') : dateTimeColumn('Submitted', 'submittedAt'),
  );
  if (showStatus) columns.push(statusColumn('Status', 'status', 120));

  return (
    <DataTable<ApprovalRequest>
      size={compact ? 'small' : 'middle'}
      rowKey="id"
      loading={loading}
      dataSource={items}
      pagination={pagination}
      locale={{ emptyText }}
      onRowClick={(row) => navigate(`/backoffice/approvals/${row.id}`)}
      scroll={compact ? {} : undefined}
      columns={columns}
    />
  );
}
