import { Table } from 'antd';
import type { Nominee } from '../../api/types';
import { humanise } from '../../utils/format';
import { useCodes } from './useCodes';

/** Nominees, beneficiaries and executors with their shares. */
export function NomineesTable({ nominees }: { nominees: Nominee[] }) {
  const relationships = useCodes('RELATIONSHIP');
  return (
    <Table<Nominee>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={nominees}
      locale={{ emptyText: 'No nominees recorded' }}
      columns={[
        { title: 'Name', dataIndex: 'fullName' },
        { title: 'IC / passport', dataIndex: 'idNumberMasked', render: (value: string | null) => value ?? '–' },
        { title: 'Relationship', dataIndex: 'relationship', render: relationships.label },
        { title: 'Role', dataIndex: 'role', render: humanise },
        { title: 'Share', dataIndex: 'sharePercent', align: 'right', render: (value: string) => `${Number(value)}%` },
      ]}
    />
  );
}
