import type { TableColumnType } from 'antd';
import type { ReportDefinition, ReportPreview } from '../../api/types';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../utils/format';
import { DataTable } from '../DataTable';
import { EmptyState } from '../EmptyState';

type Row = ReportPreview['rows'][number] & { rowKey: number };
type Column = ReportDefinition['columns'][number];

const FORMATTERS: Record<Column['type'], (value: string | number | null) => string> = {
  text: (value) => (value === null || value === '' ? '–' : String(value)),
  number: formatNumber,
  money: formatMoney,
  date: (value) => formatDate(value === null ? null : String(value)),
  datetime: (value) => formatDateTime(value === null ? null : String(value)),
};

const DEFAULT_WIDTH: Record<Column['type'], number | undefined> = {
  text: undefined,
  number: 110,
  money: 140,
  date: 120,
  datetime: 160,
};
/** Report widths are given in characters (for the spreadsheet export). */
const CHARACTER_WIDTH = 8;
const CELL_PADDING = 24;
const MIN_WIDTH = 100;

function pixelWidth(column: Column): number | undefined {
  if (column.width === undefined) return DEFAULT_WIDTH[column.type];
  return Math.max(MIN_WIDTH, column.width * CHARACTER_WIDTH + CELL_PADDING);
}

function toColumn(column: Column): TableColumnType<Row> {
  const numeric = column.type === 'money' || column.type === 'number';
  return {
    key: column.key,
    title: column.header,
    dataIndex: column.key,
    width: pixelWidth(column),
    align: numeric ? 'right' : undefined,
    className: numeric ? 'money' : undefined,
    ellipsis: column.type === 'text',
    render: (value: string | number | null) => FORMATTERS[column.type](value ?? null),
  };
}

/** BO-22/23: on-screen preview of a report, formatted by column type. */
export function ReportPreviewTable({ preview }: { preview: ReportPreview }) {
  return (
    <DataTable<Row>
      size="small"
      rowKey="rowKey"
      dataSource={preview.rows.map((row, index) => ({ ...row, rowKey: index }))}
      columns={preview.columns.map(toColumn)}
      pagination={{
        pageSize: 50,
        showSizeChanger: false,
        showTotal: (total) => `${total} row${total === 1 ? '' : 's'}`,
      }}
      locale={{ emptyText: <EmptyState label="No data for the selected filters" /> }}
    />
  );
}
