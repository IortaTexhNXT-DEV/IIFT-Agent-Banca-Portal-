import { Alert } from 'antd';
import type { AmlStatus } from '../../api/types';

const OUTCOMES: Record<
  AmlStatus,
  { type: 'success' | 'warning' | 'error' | 'info'; title: string }
> = {
  CLEAR: { type: 'success', title: 'AML screening clear' },
  FLAGGED: {
    type: 'warning',
    title: 'Possible watch-list match – submission held until Compliance clears it',
  },
  REJECTED: { type: 'error', title: 'Not accepted by Compliance – no new quotations' },
  NOT_SCREENED: { type: 'info', title: 'Not yet screened – screened on submission' },
};

/** AML/KYC screening result for a participant (AP-13/16), as a one-line status. */
export function AmlOutcome({ status, className }: { status: AmlStatus; className?: string }) {
  const outcome = OUTCOMES[status];
  return <Alert className={className} type={outcome.type} showIcon title={outcome.title} />;
}
