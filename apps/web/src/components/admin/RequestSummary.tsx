import { Alert } from 'antd';
import type { ApprovalRequest } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { FieldGrid } from '../FieldGrid';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';

/** Key facts of a maker-checker request: type, maker, level reached and outcome. */
export function RequestSummary({ request }: { request: ApprovalRequest }) {
  const level =
    request.status === 'PENDING'
      ? `Level ${request.currentLevel} of ${request.totalLevels}`
      : `${request.totalLevels} level${request.totalLevels === 1 ? '' : 's'}`;
  return (
    <FieldGrid
      columns={3}
      items={[
        { key: 'type', label: 'Request type', value: humanise(request.type) },
        { key: 'status', label: 'Status', value: <StatusTag status={request.status} /> },
        { key: 'level', label: 'Approval', value: level },
        { key: 'maker', label: 'Submitted by', value: request.makerName },
        { key: 'submitted', label: 'Submitted', value: formatDateTime(request.submittedAt) },
        { key: 'decided', label: 'Decided', value: formatDateTime(request.decidedAt) },
        request.amount !== null && {
          key: 'amount',
          label: 'Amount',
          value: <Money value={request.amount} strong />,
        },
        { key: 'summary', label: 'Summary', value: request.summary, span: 'full' },
        request.finalRemarks && {
          key: 'remarks',
          label: 'Decision remarks',
          value: request.finalRemarks,
          span: 'full',
        },
      ]}
    />
  );
}

/** AP-51: rejection reason, with a pointer to correct and resubmit from the record itself. */
export function RejectionAlert({
  request,
  resubmitHint,
}: {
  request: ApprovalRequest;
  resubmitHint?: string;
}) {
  if (request.status !== 'REJECTED') return null;
  return (
    <Alert
      className="mb-16"
      type="error"
      showIcon
      title="Rejected"
      description={
        <>
          {request.finalRemarks ?? 'No remarks given.'}
          {resubmitHint && <div className="muted">{resubmitHint}</div>}
        </>
      }
    />
  );
}
