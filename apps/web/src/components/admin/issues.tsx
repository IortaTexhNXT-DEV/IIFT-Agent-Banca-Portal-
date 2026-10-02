import { Flex, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { formatDateTime } from '../../utils/format';

export const ISSUE_STATUSES: IssueStatus[] = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
export const ISSUE_PRIORITIES: IssuePriority[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const DOCUMENT_TYPES = ['SCREENSHOT', 'OTHER'];

/** Document types offered for issue attachments (AP-57). */
export function issueUploadTypes(labelOf: (code: string) => string) {
  return DOCUMENT_TYPES.map((docType) => ({ docType, label: labelOf(docType), mandatory: false }));
}

export function isIssueOpen(issue: Pick<Issue, 'status'>): boolean {
  return issue.status !== 'RESOLVED' && issue.status !== 'CLOSED';
}

/** A response or resolution target: the due time, flagged when it has passed unmet. */
export function SlaDue({ due, metAt, open }: { due: string; metAt: string | null; open: boolean }) {
  const missed = metAt ? dayjs(metAt).isAfter(due) : open && dayjs().isAfter(due);
  return (
    <Typography.Text type={missed ? 'danger' : undefined}>
      {formatDateTime(due)}
      {metAt && !missed && <span className="muted"> · met</span>}
      {missed && ' · missed'}
    </Typography.Text>
  );
}

export function SlaBreachedTag({ issue }: { issue: Pick<Issue, 'slaBreached'> }) {
  if (!issue.slaBreached) return null;
  return (
    <Tag color="red" variant="filled">
      SLA breached
    </Tag>
  );
}

export function IssueTitle({ issue }: { issue: Pick<Issue, 'title' | 'slaBreached'> }) {
  return (
    <Flex gap={8} align="center" wrap>
      {issue.title}
      <SlaBreachedTag issue={issue} />
    </Flex>
  );
}
