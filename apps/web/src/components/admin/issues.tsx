import dayjs from 'dayjs';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { formatDateTime } from '../../utils/format';
import type { StatusTone } from '../../utils/status';
import { StatusTag } from '../StatusTag';

export const ISSUE_STATUSES: IssueStatus[] = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];
export const ISSUE_PRIORITIES: IssuePriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const DOCUMENT_TYPES = ['SCREENSHOT', 'OTHER'];

/** Document types offered for issue attachments (AP-57). */
export function issueUploadTypes(labelOf: (code: string) => string) {
  return DOCUMENT_TYPES.map((docType) => ({ docType, label: labelOf(docType), mandatory: false }));
}

export function isIssueOpen(issue: Pick<Issue, 'status'>): boolean {
  return issue.status !== 'RESOLVED' && issue.status !== 'CLOSED';
}

type SlaState = 'met' | 'breached' | 'due';

export function slaState(due: string, metAt: string | null, open: boolean): SlaState {
  if (metAt) return dayjs(metAt).isAfter(due) ? 'breached' : 'met';
  return open && dayjs().isAfter(due) ? 'breached' : 'due';
}

const SLA_TAG: Record<SlaState, { tone: StatusTone; label: string } | null> = {
  met: { tone: 'positive', label: 'Met' },
  breached: { tone: 'negative', label: 'Breached' },
  due: null,
};

/** A response or resolution target: the due time with a tag once it is met or breached. */
export function SlaDue({ due, metAt, open }: { due: string; metAt: string | null; open: boolean }) {
  const tag = SLA_TAG[slaState(due, metAt, open)];
  return (
    <span className="tag-row">
      {formatDateTime(due)}
      {tag && <StatusTag tone={tag.tone} label={tag.label} />}
    </span>
  );
}

export function SlaBreachedTag({ issue }: { issue: Pick<Issue, 'slaBreached'> }) {
  if (!issue.slaBreached) return null;
  return <StatusTag tone="negative" label="SLA breached" />;
}
