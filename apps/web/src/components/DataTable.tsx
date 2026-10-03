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
import { Skeleton, Table, type TableProps, Tooltip } from 'antd';
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
  // The first load shows skeleton rows; later loads (paging, filters) keep the rows and
  // show the table's own spinner.
  if (props.loading === true && (props.dataSource?.length ?? 0) === 0) {
    return (
      <div className="table-skeleton" aria-busy="true" aria-label="Loading">
        <Skeleton active title={false} paragraph={{ rows: 5, width: '100%' }} />
      </div>
    );
  }
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
    className: 'cell-nowrap',
    render: (value: MoneyValue | null) => <Money value={value} />,
  };
}

export function dateColumn<T>(title: string, dataIndex: DataIndex, width = 120): ColumnType<T> {
  return {
    title,
    dataIndex,
    width,
    className: 'cell-nowrap',
    render: (value: string | null) => formatDate(value),
  };
}

export function dateTimeColumn<T>(title: string, dataIndex: DataIndex, width = 170): ColumnType<T> {
  return {
    title,
    dataIndex,
    width,
    className: 'cell-nowrap',
    render: (value: string | null) => formatDateTime(value),
  };
}

/** Fixed-width status column; the chips line up because every StatusTag has the same size. */
export function statusColumn<T>(title: string, dataIndex: DataIndex, width = 130): ColumnType<T> {
  return {
    title,
    dataIndex,
    width: Math.max(width, 130),
    className: 'cell-nowrap',
    render: (status: string | null) => <StatusTag status={status} />,
  };
}

/** Payment statuses are longer ("Pending verification"), so the chip and column are wider. */
export function paymentStatusColumn<T>(
  title: string,
  dataIndex: DataIndex,
  width = 156,
): ColumnType<T> {
  return {
    title,
    dataIndex,
    width: Math.max(width, 156),
    className: 'cell-nowrap',
    render: (status: string | null) => <StatusTag status={status} wide />,
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
