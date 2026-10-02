import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Checkbox, Input, Select, Table } from 'antd';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  IssueTitle,
  isIssueOpen,
  SlaDue,
} from '../../components/admin/issues';
import { basePathFor } from '../../components/admin/links';
import { ReportIssueModal } from '../../components/admin/ReportIssueModal';
import { enumOptions, useCodes } from '../../components/admin/useCodes';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

interface Filters {
  search?: string;
  status?: IssueStatus;
  priority?: IssuePriority;
  assignedToMe?: boolean;
  breachedOnly?: boolean;
}

/** AP-55..57, BO-29..31: issues reported by the user, or every issue for support managers. */
export default function IssueListPage() {
  const { user, can } = useAuth();
  const [searchParams] = useSearchParams();
  const audience = user?.audience ?? 'PORTAL';
  const base = basePathFor(audience);
  const manager = audience === 'BACKOFFICE' && can(P.boIssuesManage);
  const [filters, setFilters] = useState<Filters>({
    breachedOnly: searchParams.get('breached') === 'true' || undefined,
  });
  const [reporting, setReporting] = useState(false);
  const categories = useCodes('ISSUE_CATEGORY');
  const issues = usePagedQuery<Issue>('/common/issues', { ...filters });

  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    issues.resetPage();
  };

  return (
    <>
      <PageHeader
        title={manager ? 'Issues' : 'Support'}
        breadcrumb={[{ title: 'Home', to: base }, { title: manager ? 'Issues' : 'Support' }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setReporting(true)}>
            Report an issue
          </Button>
        }
      />
      <FilterBar>
        <Input.Search
          allowClear
          placeholder="Issue no. or title"
          aria-label="Search issues"
          style={{ width: 240 }}
          onSearch={(value) => update({ search: value.trim() || undefined })}
        />
        <Select
          allowClear
          placeholder="Status"
          aria-label="Status"
          style={{ width: 150 }}
          options={enumOptions(ISSUE_STATUSES, humanise)}
          onChange={(status?: IssueStatus) => update({ status })}
        />
        <Select
          allowClear
          placeholder="Priority"
          aria-label="Priority"
          style={{ width: 140 }}
          options={enumOptions(ISSUE_PRIORITIES, humanise)}
          onChange={(priority?: IssuePriority) => update({ priority })}
        />
        {manager && (
          <>
            <Checkbox
              checked={filters.assignedToMe ?? false}
              onChange={(event) => update({ assignedToMe: event.target.checked || undefined })}
            >
              Assigned to me
            </Checkbox>
            <Checkbox
              checked={filters.breachedOnly ?? false}
              onChange={(event) => update({ breachedOnly: event.target.checked || undefined })}
            >
              SLA breached
            </Checkbox>
          </>
        )}
      </FilterBar>
      <Card className="content-card">
        <Table<Issue>
          size="middle"
          rowKey="id"
          loading={issues.isFetching}
          dataSource={issues.items}
          pagination={issues.pagination}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: manager ? 'No issues match the filters' : 'You have not reported any issues',
          }}
          columns={[
            {
              title: 'Issue no.',
              dataIndex: 'issueNo',
              render: (no: string, issue) => <Link to={`${base}/issues/${issue.id}`}>{no}</Link>,
            },
            {
              title: 'Title',
              dataIndex: 'title',
              width: 320,
              render: (_: unknown, issue) => <IssueTitle issue={issue} />,
            },
            { title: 'Category', dataIndex: 'category', render: categories.labelOf },
            {
              title: 'Priority',
              dataIndex: 'priority',
              render: (priority: string) => <StatusTag status={priority} />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status: string) => <StatusTag status={status} />,
            },
            ...(manager ? [{ title: 'Reported by', dataIndex: 'reportedByName' }] : []),
            {
              title: 'Assigned to',
              dataIndex: 'assignedToName',
              render: (name: string | null) => name ?? 'Unassigned',
            },
            {
              title: 'Response due',
              dataIndex: 'responseDueAt',
              render: (_: unknown, issue) => (
                <SlaDue
                  due={issue.responseDueAt}
                  metAt={issue.firstRespondedAt}
                  open={isIssueOpen(issue)}
                />
              ),
            },
            {
              title: 'Resolution due',
              dataIndex: 'resolutionDueAt',
              render: (_: unknown, issue) => (
                <SlaDue
                  due={issue.resolutionDueAt}
                  metAt={issue.resolvedAt}
                  open={isIssueOpen(issue)}
                />
              ),
            },
            { title: 'Reported', dataIndex: 'createdAt', render: formatDateTime },
          ]}
        />
      </Card>
      {reporting && <ReportIssueModal onClose={() => setReporting(false)} />}
    </>
  );
}
