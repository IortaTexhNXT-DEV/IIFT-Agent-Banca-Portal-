import type { AmlScreening } from '../../api/types';
import { humanise } from '../../utils/format';
import { DataTable, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';

type Match = AmlScreening['matches'][number];

/** Expanded-row renderer for tables of screenings. */
export function renderScreeningMatches(screening: AmlScreening) {
  return <AmlMatchesTable matches={screening.matches} />;
}

/** BO-14: watch-list hits behind a screening result, with the match score and reason. */
export function AmlMatchesTable({ matches }: { matches: Match[] }) {
  return (
    <DataTable<Match>
      size="small"
      pagination={false}
      rowKey={(match) => `${match.listName}-${match.reference ?? match.name}`}
      dataSource={matches}
      scroll={{}}
      className="aml-matches"
      locale={{ emptyText: <EmptyState label="No watch-list matches" inline /> }}
      columns={[
        textColumn('List', 'listName', 160),
        textColumn('Matched name', 'name'),
        textColumn('Reference', 'reference', 140),
        { title: 'Score', dataIndex: 'score', width: 80, align: 'right', className: 'money' },
        { title: 'Reason', dataIndex: 'reason', width: 150, render: humanise },
      ]}
    />
  );
}
