import { Alert } from 'antd';
import type { AmlStatus } from '../../api/types';

const OUTCOMES: Record<
  AmlStatus,
  { type: 'success' | 'warning' | 'error' | 'info'; title: string; description: string }
> = {
  CLEAR: {
    type: 'success',
    title: 'AML screening clear',
    description: 'No watch-list match was found for this participant.',
  },
  FLAGGED: {
    type: 'warning',
    title: 'Possible watch-list match – under Compliance review',
    description:
      'You can prepare quotations now. Applications can be submitted once Compliance clears the case.',
  },
  REJECTED: {
    type: 'error',
    title: 'Not accepted by Compliance',
    description: 'New quotations cannot be prepared for this participant.',
  },
  NOT_SCREENED: {
    type: 'info',
    title: 'Not yet screened',
    description: 'The participant is screened automatically when the application is submitted.',
  },
};

/** Explains the AML/KYC screening result for a participant (AP-13/16). */
export function AmlOutcome({ status, className }: { status: AmlStatus; className?: string }) {
  const outcome = OUTCOMES[status];
  return (
    <Alert
      className={className}
      type={outcome.type}
      showIcon
      title={outcome.title}
      description={outcome.description}
    />
  );
}
