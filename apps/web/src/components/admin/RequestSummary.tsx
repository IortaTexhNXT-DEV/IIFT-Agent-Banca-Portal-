import { Alert, Descriptions } from 'antd';
import type { ApprovalRequest } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';

/** Key facts of a maker-checker request: type, maker, level reached and outcome. */
export function RequestSummary({ request }: { request: ApprovalRequest }) {
  const level = request.status === 'PENDING' ? `Level ${request.currentLevel} of ${request.totalLevels}` : `${request.totalLevels} level${request.totalLevels === 1 ? '' : 's'}`;
  return (
    <Descriptions
      size="small"
      column={{ xs: 1, md: 2, xl: 3 }}
      items={[
        { key: 'type', label: 'Request type', children: humanise(request.type) },
        { key: 'status', label: 'Status', children: <StatusTag status={request.status} /> },
        { key: 'level', label: 'Approval', children: level },
        { key: 'summary', label: 'Summary', children: request.summary, span: 'filled' },
        { key: 'maker', label: 'Submitted by', children: request.makerName },
        { key: 'submitted', label: 'Submitted', children: formatDateTime(request.submittedAt) },
        { key: 'decided', label: 'Decided', children: formatDateTime(request.decidedAt) },
        ...(request.amount !== null ? [{ key: 'amount', label: 'Amount', children: <Money value={request.amount} /> }] : []),
        ...(request.finalRemarks ? [{ key: 'remarks', label: 'Decision remarks', children: request.finalRemarks, span: 'filled' as const }] : []),
      ]}
    />
  );
}

/** AP-51: rejection reason, with a pointer to correct and resubmit from the record itself. */
export function RejectionAlert({ request, resubmitHint }: { request: ApprovalRequest; resubmitHint?: string }) {
  if (request.status !== 'REJECTED') return null;
  return (
    <Alert
      className="mb-16"
      type="error"
      showIcon
      title="This request was rejected"
      description={
        <>
          {request.finalRemarks ?? 'No remarks were given.'}
          {resubmitHint && <div className="muted">{resubmitHint}</div>}
        </>
      }
    />
  );
}
