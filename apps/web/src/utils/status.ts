/**
 * Colour of each status value in tags. One colour per semantic group, so every screen reads
 * the same way: grey for drafts and closed records, orange for anything waiting on someone,
 * green for in-force / paid / verified, red for rejected, cancelled, expired or failed, and
 * blue for informational in-progress states.
 */
export type StatusTone = 'default' | 'pending' | 'positive' | 'negative' | 'info';

export const TONE_COLOURS: Record<StatusTone, string> = {
  default: 'default',
  pending: 'orange',
  positive: 'green',
  negative: 'red',
  info: 'blue',
};

const GROUPS: Record<StatusTone, string[]> = {
  default: [
    'DRAFT',
    'INACTIVE',
    'TERMINATED',
    'WITHDRAWN',
    'CLOSED',
    'NOT_SCREENED',
    'LOW',
    'DISABLED',
  ],
  pending: [
    'PENDING',
    'PENDING_APPROVAL',
    'PENDING_PAYMENT',
    'PENDING_VERIFICATION',
    'PENDING_REVIEW',
    'UNDER_REVIEW',
    'UNPAID',
    'LOCKED',
    'MEDIUM',
    'HIGH',
  ],
  positive: [
    'ACTIVE',
    'APPROVED',
    'VERIFIED',
    'PAID',
    'CLEAR',
    'CLEARED',
    'AUTO_CLEARED',
    'ACKNOWLEDGED',
    'RESOLVED',
    'COMPLETED',
    'MATCHED',
    'SENT',
    'ISSUED',
  ],
  negative: [
    'REJECTED',
    'CANCELLED',
    'EXPIRED',
    'CONFIRMED_MATCH',
    'FLAGGED',
    'FAILED',
    'DEAD',
    'MISMATCH',
    'SUSPENDED',
    'CRITICAL',
  ],
  info: ['SUBMITTED', 'ASSIGNED', 'IN_PROGRESS', 'OPEN', 'UPLOADED', 'RUNNING', 'QUEUED'],
};

const STATUS_TONES = new Map<string, StatusTone>();
for (const [tone, statuses] of Object.entries(GROUPS) as [StatusTone, string[]][]) {
  for (const status of statuses) STATUS_TONES.set(status, tone);
}

export function statusTone(status: string | null | undefined): StatusTone {
  return (status && STATUS_TONES.get(status)) || 'default';
}

export function statusColour(status: string | null | undefined): string {
  return TONE_COLOURS[statusTone(status)];
}
