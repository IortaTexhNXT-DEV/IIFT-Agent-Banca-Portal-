import { Timeline, Typography } from 'antd';
import { EmptyState } from '../EmptyState';
import type { PolicyEvent } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { StatusTag } from '../StatusTag';

/** Lifecycle of a quotation / policy: every action with its status change, actor and remarks. */
export function PolicyEventsTimeline({ events }: { events: PolicyEvent[] }) {
  if (events.length === 0) {
    return <EmptyState label="No history yet" />;
  }
  return (
    <Timeline
      items={events.map((event) => ({
        key: event.id,
        title: formatDateTime(event.createdAt),
        content: (
          <>
            <Typography.Text strong>{humanise(event.action)}</Typography.Text>
            {event.toStatus && event.toStatus !== event.fromStatus && (
              <>
                {' '}
                <StatusTag status={event.toStatus} />
              </>
            )}
            {event.actorName && <div className="muted">by {event.actorName}</div>}
            {event.remarks && <div>{event.remarks}</div>}
          </>
        ),
      }))}
    />
  );
}
