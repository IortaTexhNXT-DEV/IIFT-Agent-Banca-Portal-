/**
 * DataTable – Ant Design Table with the house defaults: middle density, horizontal scroll
 * instead of squeezed columns (pass scroll={{}} for a table that should fit its card),
 * pagination bottom-right and optional whole-row navigation.
 * Column helpers keep money, dates, statuses and long text consistent across lists.
 *
 *   <DataTable<PolicySummary>
 *     rowKey="id"
 *     onRowClick={(row) => navigate(links.policy(row.id))}
 *     columns={[
 *       textColumn('Participant', ['participant', 'fullName'], 220),
 *       moneyColumn('Contribution', 'contribution'),
 *       dateColumn('Created', 'createdAt'),
 *       statusColumn('Status', 'status'),
 *     ]}
 *   />
 */
import { Table, type TableProps, Tooltip } from 'antd';
import type { ColumnType } from 'antd/es/table';
import type { Money as MoneyValue } from '../api/types';
import { formatDate, formatDateTime } from '../utils/format';
import { Money } from './Money';
import { StatusTag } from './StatusTag';

type DataIndex = string | string[];

interface Props<T> extends TableProps<T> {
  /** Opens the record when a row is clicked (links inside the row keep working). */
  onRowClick?(record: T): void;
}

/** Width given to columns without one when sizing the scroll area. */
const FLEX_COLUMN_WIDTH = 180;
/** Narrower allowance for tables that must fit their card (scroll={{}}). */
const FIT_FLEX_COLUMN_WIDTH = 120;

export function DataTable<T extends object>({
  onRowClick,
  size = 'middle',
  scroll,
  pagination,
  columns = [],
  ...props
}: Props<T>) {
  // The table scrolls once its container is narrower than the columns need; wider
  // containers share the extra space. An empty scroll object ("fit the card") allows less
  // room for flexible columns so the table fits a desktop card and still scrolls on phones.
  const fit = scroll !== undefined && Object.keys(scroll).length === 0;
  const flexWidth = fit ? FIT_FLEX_COLUMN_WIDTH : FLEX_COLUMN_WIDTH;
  const minWidth = columns.reduce(
    (sum, column) => sum + (typeof column.width === 'number' ? column.width : flexWidth),
    0,
  );
  return (
    <Table<T>
      size={size}
      columns={columns}
      scroll={fit || !scroll ? { x: minWidth } : scroll}
      pagination={pagination === false ? false : { placement: ['bottomEnd'], ...pagination }}
      rowClassName={onRowClick ? 'clickable-row' : undefined}
      onRow={
        onRowClick
          ? (record) => ({
              onClick: (event) => {
                if ((event.target as HTMLElement).closest('a, button, input, .ant-dropdown'))
                  return;
                onRowClick(record);
              },
            })
          : undefined
      }
      {...props}
    />
  );
}

/** Right-aligned amount in B$ with tabular figures. */
export function moneyColumn<T>(title: string, dataIndex: DataIndex, width = 140): ColumnType<T> {
  return {
    title,
    dataIndex,
    width,
    align: 'right',
    render: (value: MoneyValue | null) => <Money value={value} />,
  };
}

export function dateColumn<T>(title: string, dataIndex: DataIndex, width = 120): ColumnType<T> {
  return { title, dataIndex, width, render: (value: string | null) => formatDate(value) };
}

export function dateTimeColumn<T>(title: string, dataIndex: DataIndex, width = 170): ColumnType<T> {
  return { title, dataIndex, width, render: (value: string | null) => formatDateTime(value) };
}

export function statusColumn<T>(title: string, dataIndex: DataIndex, width = 150): ColumnType<T> {
  return {
    title,
    dataIndex,
    width,
    render: (status: string | null) => <StatusTag status={status} />,
  };
}

/**
 * Long text cut to one line at the column width, with the full text in a tooltip.
 * Without a width the column takes the space left by the others.
 */
export function textColumn<T>(title: string, dataIndex: DataIndex, width?: number): ColumnType<T> {
  return {
    title,
    dataIndex,
    width,
    ellipsis: { showTitle: false },
    render: (value: string | null) =>
      value ? (
        <Tooltip title={value} placement="topLeft">
          {value}
        </Tooltip>
      ) : (
        '–'
      ),
  };
}
