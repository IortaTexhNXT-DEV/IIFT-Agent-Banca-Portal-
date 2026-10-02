import { Empty, Timeline, Typography } from 'antd';
import type { ApprovalRequest } from '../api/types';
import { formatDateTime, humanise } from '../utils/format';
import { StatusTag } from './StatusTag';

const ACTION_COLOURS: Record<string, string> = { SUBMIT: 'blue', APPROVE: 'green', REJECT: 'red', WITHDRAW: 'gray' };

/** Maker-checker history (AP-61): every request with each level's decision and remarks. */
export function ApprovalHistory({ approvals }: { approvals: ApprovalRequest[] }) {
  if (approvals.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No approval requests" />;
  }
  return (
    <div className="approval-history">
      {approvals.map((request) => (
        <div key={request.id} className="approval-history__request">
          <Typography.Text strong>
            {request.requestNo} · {humanise(request.type)}
          </Typography.Text>{' '}
          <StatusTag status={request.status} />
          <Typography.Paragraph type="secondary" className="approval-history__summary">
            {request.summary}
          </Typography.Paragraph>
          <Timeline
            items={(request.actions ?? []).map((action) => ({
              color: ACTION_COLOURS[action.action],
              title: formatDateTime(action.createdAt),
              content: (
                <>
                  <Typography.Text>
                    {humanise(action.action)}
                    {action.level > 0 ? ` (level ${action.level})` : ''} by {action.actorName}
                  </Typography.Text>
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
