import type { AmlScreening } from '../../api/types';
import { DataTable, dateTimeColumn, statusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';

/** BO: every AML / watch-list screening of a participant with the compliance decision. */
export function AmlScreeningsTable({ screenings }: { screenings: AmlScreening[] }) {
  return (
    <DataTable<AmlScreening>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={screenings.map((screening) => ({
        ...screening,
        matchSummary:
          screening.matches.length === 0
            ? 'None'
            : screening.matches
                .map((match) => `${match.name} (${match.listName}, ${match.score})`)
                .join('; '),
      }))}
      scroll={{}}
      locale={{ emptyText: <EmptyState label="No screenings" /> }}
      columns={[
        dateTimeColumn('Screened', 'createdAt', 160),
        { title: 'Provider', dataIndex: 'provider', width: 130 },
        { title: 'Score', dataIndex: 'score', width: 80, align: 'right' },
        textColumn('Matches', 'matchSummary'),
        statusColumn('Outcome', 'status', 140),
        dateTimeColumn('Reviewed', 'reviewedAt', 160),
        textColumn('Review remarks', 'reviewRemarks', 200),
      ]}
    />
  );
}
