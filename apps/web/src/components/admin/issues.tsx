import { Tag } from 'antd';
import dayjs from 'dayjs';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { formatDateTime } from '../../utils/format';

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

const SLA_TAG: Record<SlaState, { colour: string; label: string } | null> = {
  met: { colour: 'green', label: 'Met' },
  breached: { colour: 'red', label: 'Breached' },
  due: null,
};

/** A response or resolution target: the due time with a tag once it is met or breached. */
export function SlaDue({ due, metAt, open }: { due: string; metAt: string | null; open: boolean }) {
  const tag = SLA_TAG[slaState(due, metAt, open)];
  return (
    <span className="tag-row">
      {formatDateTime(due)}
      {tag && (
        <Tag color={tag.colour} variant="filled" className="status-tag">
          {tag.label}
        </Tag>
      )}
    </span>
  );
}

export function SlaBreachedTag({ issue }: { issue: Pick<Issue, 'slaBreached'> }) {
  if (!issue.slaBreached) return null;
  return (
    <Tag color="red" variant="filled" className="status-tag">
      SLA breached
    </Tag>
  );
}
