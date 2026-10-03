import type { Nominee } from '../../api/types';
import { DataTable, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { humanise } from '../../utils/format';
import { useCodes } from './useCodes';

/** Nominees, beneficiaries and executors with their shares. */
export function NomineesTable({ nominees }: { nominees: Nominee[] }) {
  const relationships = useCodes('RELATIONSHIP');
  return (
    <DataTable<Nominee>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={nominees}
      scroll={{}}
      locale={{ emptyText: <EmptyState label="No nominees yet" inline /> }}
      columns={[
        textColumn('Name', 'fullName'),
        {
          title: 'ID',
          dataIndex: 'idNumberMasked',
          width: 140,
          render: (value: string | null) => value ?? '–',
        },
        {
          title: 'Relationship',
          dataIndex: 'relationship',
          width: 150,
          render: relationships.label,
        },
        { title: 'Role', dataIndex: 'role', width: 120, render: humanise },
        {
          title: 'Share',
          dataIndex: 'sharePercent',
          width: 90,
          align: 'right',
          render: (value: string) => `${Number(value)}%`,
        },
      ]}
    />
  );
}
