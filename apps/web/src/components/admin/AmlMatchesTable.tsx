import { Table } from 'antd';
import type { AmlScreening } from '../../api/types';
import { humanise } from '../../utils/format';

type Match = AmlScreening['matches'][number];

/** Expanded-row renderer for tables of screenings. */
export function renderScreeningMatches(screening: AmlScreening) {
  return <AmlMatchesTable matches={screening.matches} />;
}

/** BO-14: watch-list hits behind a screening result, with the match score and reason. */
export function AmlMatchesTable({ matches }: { matches: Match[] }) {
  return (
    <Table<Match>
      size="small"
      pagination={false}
      rowKey={(match) => `${match.listName}-${match.reference ?? match.name}`}
      dataSource={matches}
      locale={{ emptyText: 'No watch-list matches' }}
      columns={[
        { title: 'List', dataIndex: 'listName', width: 180 },
        { title: 'Matched name', dataIndex: 'name' },
        {
          title: 'Reference',
          dataIndex: 'reference',
          width: 140,
          render: (value: string | null | undefined) => value ?? '–',
        },
        { title: 'Score', dataIndex: 'score', width: 90, align: 'right' },
        { title: 'Reason', dataIndex: 'reason', width: 140, render: humanise },
      ]}
    />
  );
}
