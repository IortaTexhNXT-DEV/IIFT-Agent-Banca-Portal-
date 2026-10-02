import { Timeline, Typography } from 'antd';
import type { ApprovalRequest } from '../api/types';
import { formatDateTime, humanise } from '../utils/format';
import { EmptyState } from './EmptyState';
import { StatusTag } from './StatusTag';

const ACTION_COLOURS: Record<string, string> = {
  SUBMIT: 'blue',
  APPROVE: 'green',
  REJECT: 'red',
  WITHDRAW: 'gray',
};

/**
 * Maker-checker history (AP-61): every request with each level's decision and remarks.
 * `compact` shows only the timeline, for a page that already shows the request itself.
 */
export function ApprovalHistory({
  approvals,
  compact = false,
}: {
  approvals: ApprovalRequest[];
  compact?: boolean;
}) {
  if (approvals.length === 0) {
    return <EmptyState label="No approval requests" />;
  }
  return (
    <div className="approval-history">
      {approvals.map((request) => (
        <div key={request.id} className="approval-history__request">
          {!compact && (
            <>
              <Typography.Text strong>
                {request.requestNo} · {humanise(request.type)}
              </Typography.Text>{' '}
              <StatusTag status={request.status} />
              <Typography.Paragraph type="secondary" className="approval-history__summary">
                {request.summary}
              </Typography.Paragraph>
            </>
          )}
          <Timeline
            items={(request.actions ?? []).map((action) => ({
              color: ACTION_COLOURS[action.action],
              content: (
                <>
                  <Typography.Text>
                    {humanise(action.action)}
                    {action.level > 0 ? ` (level ${action.level})` : ''} by {action.actorName}
                  </Typography.Text>
                  <div className="timeline-time">{formatDateTime(action.createdAt)}</div>
                  {action.remarks && <div className="muted">“{action.remarks}”</div>}
                </>
              ),
            }))}
          />
        </div>
      ))}
    </div>
  );
}
