import { Table } from 'antd';
import { formatValue, isHiddenKey, isRecord, keyLabel } from './values';
import '../../styles/admin.css';

interface Props {
  before: unknown;
  after: unknown;
  beforeTitle?: string;
  afterTitle?: string;
}

interface Row {
  key: string;
  before: string;
  after: string;
  changed: boolean;
}

function display(key: string, value: unknown): string {
  return isRecord(value) || Array.isArray(value) ? JSON.stringify(value) : formatValue(key, value);
}

/** Field-by-field comparison of two JSON objects; changed fields are highlighted. */
export function ChangeTable({
  before,
  after,
  beforeTitle = 'Before',
  afterTitle = 'After',
}: Props) {
  const left = isRecord(before) ? before : {};
  const right = isRecord(after) ? after : {};
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter(
    (key) => !isHiddenKey(key),
  );
  const rows: Row[] = keys.map((key) => {
    const from = key in left ? display(key, left[key]) : '–';
    const to = key in right ? display(key, right[key]) : '–';
    return { key, before: from, after: to, changed: from !== to };
  });

  return (
    <Table<Row>
      size="small"
      rowKey="key"
      pagination={false}
      dataSource={rows}
      locale={{ emptyText: 'No field values recorded' }}
      rowClassName={(row) => (row.changed ? 'change-row--changed' : '')}
      columns={[
        { title: 'Field', dataIndex: 'key', width: 200, render: keyLabel },
        { title: beforeTitle, dataIndex: 'before', className: 'change-cell' },
        { title: afterTitle, dataIndex: 'after', className: 'change-cell' },
      ]}
    />
  );
}
