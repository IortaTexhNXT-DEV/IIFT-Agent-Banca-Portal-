import { Alert, Table, type TableColumnType } from 'antd';
import type { ReportDefinition, ReportPreview } from '../../api/types';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../utils/format';

type Row = ReportPreview['rows'][number] & { rowKey: number };
type Column = ReportDefinition['columns'][number];

const FORMATTERS: Record<Column['type'], (value: string | number | null) => string> = {
  text: (value) => (value === null || value === '' ? '–' : String(value)),
  number: formatNumber,
  money: formatMoney,
  date: (value) => formatDate(value === null ? null : String(value)),
  datetime: (value) => formatDateTime(value === null ? null : String(value)),
};

function toColumn(column: Column): TableColumnType<Row> {
  const numeric = column.type === 'money' || column.type === 'number';
  return {
    key: column.key,
    title: column.header,
    dataIndex: column.key,
    align: numeric ? 'right' : undefined,
    className: numeric ? 'money' : undefined,
    render: (value: string | number | null) => FORMATTERS[column.type](value ?? null),
  };
}

/** BO-22/23: on-screen preview of a report, formatted by column type. */
export function ReportPreviewTable({ preview }: { preview: ReportPreview }) {
  return (
    <>
      {preview.truncated && (
        <Alert
          className="mb-16"
          type="info"
          showIcon
          title={`Showing the first ${preview.rows.length} rows. Export the report for the complete result.`}
        />
      )}
      <Table<Row>
        size="small"
        rowKey="rowKey"
        dataSource={preview.rows.map((row, index) => ({ ...row, rowKey: index }))}
        columns={preview.columns.map(toColumn)}
        pagination={{
          pageSize: 50,
          showSizeChanger: false,
          showTotal: (total) => `${total} row${total === 1 ? '' : 's'}`,
        }}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No data for the selected filters' }}
      />
    </>
  );
}
