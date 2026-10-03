import type { ColumnsType } from 'antd/es/table';
import type { PolicyEvent } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { DataTable } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { StatusTag } from '../StatusTag';

const COLUMNS: ColumnsType<PolicyEvent> = [
  {
    title: 'When',
    dataIndex: 'createdAt',
    width: 170,
    className: 'cell-nowrap',
    render: (value: string) => formatDateTime(value),
  },
  {
    title: 'Event',
    dataIndex: 'action',
    width: 220,
    className: 'cell-nowrap',
    render: (value: string) => <span className="event-cell">{humanise(value)}</span>,
  },
  {
    title: 'Status',
    key: 'status',
    width: 130,
    className: 'cell-nowrap',
    render: (_, event) =>
      event.toStatus && event.toStatus !== event.fromStatus ? (
        <StatusTag status={event.toStatus} />
      ) : null,
  },
  {
    title: 'By',
    dataIndex: 'actorName',
    width: 220,
    ellipsis: true,
    render: (value: string | null) => value ?? <span className="muted">System</span>,
  },
  {
    title: 'Details',
    dataIndex: 'remarks',
    render: (value: string | null) => value ?? '–',
  },
];

/**
 * Lifecycle of a quotation / policy as an event log: when, what happened (with the status it
 * led to), who did it and the remarks recorded (AP-24, AP-47).
 */
export function PolicyEventsTimeline({ events }: { events: PolicyEvent[] }) {
  return (
    <DataTable<PolicyEvent>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={events}
      columns={COLUMNS}
      scroll={{}}
      locale={{ emptyText: <EmptyState label="No history yet" /> }}
    />
  );
}
