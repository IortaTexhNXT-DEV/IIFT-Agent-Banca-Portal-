import type { ApprovalRequest } from '../api/types';
import { formatDateTime, humanise } from '../utils/format';
import type { StatusTone } from '../utils/status';
import { EmptyState } from './EmptyState';
import { StatusTag } from './StatusTag';

const ACTIONS: Record<string, { tone: StatusTone; label: string }> = {
  SUBMIT: { tone: 'info', label: 'Submitted' },
  APPROVE: { tone: 'positive', label: 'Approved' },
  REJECT: { tone: 'negative', label: 'Rejected' },
  WITHDRAW: { tone: 'default', label: 'Withdrawn' },
};

type Action = NonNullable<ApprovalRequest['actions']>[number];

/** Left-anchored log of the maker-checker actions of one request: when, what, who, remarks. */
export function ApprovalActionLog({ actions }: { actions: Action[] }) {
  if (actions.length === 0) return <EmptyState label="No actions yet" inline />;
  return (
    <ol className="event-log">
      {actions.map((action) => (
        <li key={action.id} className="event-log__row">
          <span className="event-log__when">{formatDateTime(action.createdAt)}</span>
          <span className="event-log__title">
            <StatusTag
              tone={ACTIONS[action.action]?.tone ?? 'default'}
              label={ACTIONS[action.action]?.label ?? humanise(action.action)}
            />
            <span className="event-log__by">
              {action.level > 0 ? `Level ${action.level} · ` : ''}
              {action.actorName}
            </span>
          </span>
          {action.remarks && <span className="event-log__detail">{action.remarks}</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Maker-checker history (AP-61): every request with each level's decision and remarks.
 * `compact` shows only the action log, for a page that already shows the request itself.
 */
export function ApprovalHistory({
  approvals,
  compact = false,
}: {
  approvals: ApprovalRequest[];
  compact?: boolean;
}) {
  if (approvals.length === 0) {
    return <EmptyState label="No approval requests yet" />;
  }
  return (
    <div className="approval-history">
      {approvals.map((request) => (
        <div key={request.id} className="approval-history__request">
          {!compact && (
            <>
              <div className="approval-history__head">
                <strong>{request.requestNo}</strong>
                <span className="muted">{humanise(request.type)}</span>
                <StatusTag status={request.status} />
              </div>
              <p className="approval-history__summary">{request.summary}</p>
            </>
          )}
          <ApprovalActionLog actions={request.actions ?? []} />
        </div>
      ))}
    </div>
  );
}
