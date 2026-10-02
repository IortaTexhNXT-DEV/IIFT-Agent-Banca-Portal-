import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Alert, Button } from 'antd';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, ApiError } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { ApprovalRequest } from '../../api/types';
import { RemarksModal } from './RemarksModal';

type Decision = 'approve' | 'reject';

/** Guidance for the business-rule errors a checker can run into. */
function guidanceFor(error: unknown): ReactNode {
  if (!(error instanceof ApiError)) return undefined;
  switch (error.code) {
    case 'SEGREGATION_OF_DUTIES':
      return 'Maker-checker control: a different approver must decide this request.';
    case 'AML_NOT_CLEARED':
      return (
        <>
          Compliance must clear the AML screening first. Review the case under{' '}
          <Link to="/backoffice/aml">AML / KYC</Link>, then approve again.
        </>
      );
    case 'DOCUMENTS_MISSING':
      return 'Ask the submitter to upload the missing documents, then approve again.';
    default:
      return undefined;
  }
}

/** BO-17..19: approve (optional remarks) or reject (remarks required) at the current level. */
export function ApprovalDecision({ request }: { request: ApprovalRequest }) {
  const [decision, setDecision] = useState<Decision>();
  const decide = useApiMutation(
    ({ action, remarks }: { action: Decision; remarks: string }) =>
      api.post<ApprovalRequest>(`/backoffice/approvals/${request.id}/${action}`, {
        remarks: remarks || undefined,
      }),
    {
      success: decision === 'approve' ? 'Request approved' : 'Request rejected',
      invalidate: ['/backoffice', '/common/notifications'],
      onSuccess: () => setDecision(undefined),
    },
  );
  const guidance = guidanceFor(decide.error);
  const open = (next: Decision) => {
    decide.reset();
    setDecision(next);
  };

  return (
    <>
      <Button danger icon={<CloseOutlined />} onClick={() => open('reject')}>
        Reject
      </Button>
      <Button type="primary" icon={<CheckOutlined />} onClick={() => open('approve')}>
        Approve
      </Button>
      {decision && (
        <RemarksModal
          title={`${decision === 'approve' ? 'Approve' : 'Reject'} ${request.requestNo}`}
          okText={decision === 'approve' ? 'Approve' : 'Reject'}
          label={decision === 'approve' ? 'Remarks' : 'Reason for rejection'}
          required={decision === 'reject'}
          danger={decision === 'reject'}
          description={
            guidance ? (
              <Alert type="warning" showIcon title={guidance} />
            ) : decision === 'reject' ? (
              'The reason is shown to the submitter.'
            ) : (
              `Approval level ${request.currentLevel} of ${request.totalLevels}.`
            )
          }
          pending={decide.isPending}
          error={decide.error}
          onSubmit={(remarks) => decide.mutate({ action: decision, remarks })}
          onClose={() => setDecision(undefined)}
        />
      )}
    </>
  );
}
