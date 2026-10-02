import { Table } from 'antd';
import type { AmlScreening } from '../../api/types';
import { formatDateTime } from '../../utils/format';
import { StatusTag } from '../StatusTag';

/** BO: every AML / watch-list screening of a participant with the compliance decision. */
export function AmlScreeningsTable({ screenings }: { screenings: AmlScreening[] }) {
  return (
    <Table<AmlScreening>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={screenings}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No screenings recorded' }}
      columns={[
        { title: 'Screened', dataIndex: 'createdAt', render: formatDateTime },
        { title: 'Provider', dataIndex: 'provider' },
        { title: 'Score', dataIndex: 'score', align: 'right' },
        {
          title: 'Matches',
          dataIndex: 'matches',
          render: (matches: AmlScreening['matches']) =>
            matches.length === 0 ? 'None' : matches.map((match) => `${match.name} (${match.listName}, ${match.score})`).join('; '),
        },
        { title: 'Outcome', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
        { title: 'Reviewed', dataIndex: 'reviewedAt', render: formatDateTime },
        { title: 'Review remarks', dataIndex: 'reviewRemarks', render: (remarks: string | null) => remarks ?? '–' },
      ]}
    />
  );
}
