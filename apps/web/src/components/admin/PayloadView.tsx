import { Table, Typography } from 'antd';
import { FieldGrid } from '../FieldGrid';
import { ChangeTable } from './ChangeTable';
import { formatValue, isHiddenKey, isRecord, keyLabel } from './values';

type Payload = Record<string, unknown>;

function visibleEntries(payload: Payload): [string, unknown][] {
  return Object.entries(payload).filter(([key]) => !isHiddenKey(key));
}

function ScalarList({ entries }: { entries: [string, unknown][] }) {
  if (entries.length === 0) return null;
  return (
    <FieldGrid
      columns={3}
      className="mb-16"
      items={entries.map(([key, value]) => ({
        key,
        label: keyLabel(key),
        value: formatValue(key, value),
      }))}
    />
  );
}

function ObjectTable({ name, rows }: { name: string; rows: Payload[] }) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter(
    (key) => !isHiddenKey(key),
  );
  return (
    <Table<Payload & { rowKey: string }>
      size="small"
      pagination={false}
      rowKey="rowKey"
      dataSource={rows.map((row, index) => ({ ...row, rowKey: `${name}-${index}` }))}
      className="mb-16"
      scroll={{ x: 'max-content' }}
      columns={columns.map((key) => ({
        key,
        title: keyLabel(key),
        render: (_: unknown, row: Payload) => formatValue(key, row[key]),
      }))}
    />
  );
}

function Section({ name, value }: { name: string; value: unknown[] | Payload }) {
  let body;
  if (isRecord(value)) {
    body = <ScalarList entries={visibleEntries(value)} />;
  } else if (value.length === 0) {
    body = <Typography.Text type="secondary">None</Typography.Text>;
  } else if (value.every(isRecord)) {
    body = <ObjectTable name={name} rows={value} />;
  } else {
    body = (
      <ul className="payload-list">
        {value.map((item, index) => (
          <li key={`${name}-${index}`}>{formatValue(name, item)}</li>
        ))}
      </ul>
    );
  }
  return (
    <div className="payload-section">
      <Typography.Title level={5}>{keyLabel(name)}</Typography.Title>
      {body}
    </div>
  );
}

/**
 * Renders the data submitted with an approval request: field changes as a
 * current/requested comparison, lists as bullet points, nested records as tables.
 */
export function PayloadView({ payload }: { payload: Payload }) {
  const { changes, before, ...rest } = payload;
  const isChangeRequest = isRecord(changes);
  const entries = visibleEntries(isChangeRequest ? rest : payload);
  const scalars = entries.filter(([, value]) => !isRecord(value) && !Array.isArray(value));
  const sections = entries.filter(
    (entry): entry is [string, unknown[] | Payload] =>
      isRecord(entry[1]) || Array.isArray(entry[1]),
  );

  return (
    <>
      <ScalarList entries={scalars} />
      {isChangeRequest && (
        <div className="payload-section">
          <Typography.Title level={5}>Requested changes</Typography.Title>
          <ChangeTable
            before={before}
            after={changes}
            beforeTitle="Current"
            afterTitle="Requested"
          />
        </div>
      )}
      {sections.map(([name, value]) => (
        <Section key={name} name={name} value={value} />
      ))}
    </>
  );
}
