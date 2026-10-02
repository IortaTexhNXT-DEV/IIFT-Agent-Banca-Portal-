import { PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Input, Select } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  isIssueOpen,
  SlaDue,
} from '../../components/admin/issues';
import { basePathFor } from '../../components/admin/links';
import { ReportIssueModal } from '../../components/admin/ReportIssueModal';
import { enumOptions, useCodes } from '../../components/admin/useCodes';
import { DataTable, dateTimeColumn, statusColumn, textColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/admin.css';

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
  const navigate = useNavigate();
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
  const title = manager ? 'Issues' : 'Support';

  return (
    <>
      <PageHeader
        title={title}
        breadcrumb={[{ title: 'Home', to: base }, { title }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setReporting(true)}>
            Report an issue
          </Button>
        }
      />
      <TableCard
        toolbar={
          <>
            <Input.Search
              allowClear
              placeholder="Issue no. or title"
              aria-label="Search issues"
              className="filter-search"
              onSearch={(value) => update({ search: value.trim() || undefined })}
            />
            <Select
              allowClear
              placeholder="Status"
              aria-label="Status"
              className="filter-select"
              options={enumOptions(ISSUE_STATUSES, humanise)}
              onChange={(status?: IssueStatus) => update({ status })}
            />
            <Select
              allowClear
              placeholder="Priority"
              aria-label="Priority"
              className="filter-select"
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
          </>
        }
      >
        <DataTable<Issue>
          rowKey="id"
          loading={issues.isFetching}
          dataSource={issues.items}
          pagination={issues.pagination}
          locale={{ emptyText: 'No issues' }}
          onRowClick={(issue) => navigate(`${base}/issues/${issue.id}`)}
          columns={[
            {
              title: 'Issue no.',
              dataIndex: 'issueNo',
              width: 130,
              render: (no: string, issue) => <Link to={`${base}/issues/${issue.id}`}>{no}</Link>,
            },
            textColumn('Title', 'title', 260),
            {
              title: 'Category',
              dataIndex: 'category',
              width: 160,
              ellipsis: true,
              render: categories.labelOf,
            },
            statusColumn('Priority', 'priority', 100),
            statusColumn('Status', 'status', 120),
            ...(manager ? [textColumn<Issue>('Reported by', 'reportedByName', 180)] : []),
            {
              title: 'Assigned to',
              dataIndex: 'assignedToName',
              width: 160,
              ellipsis: true,
              render: (name: string | null) => name ?? <span className="muted">Unassigned</span>,
            },
            {
              title: 'Response due',
              dataIndex: 'responseDueAt',
              width: 190,
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
              width: 190,
              render: (_: unknown, issue) => (
                <SlaDue
                  due={issue.resolutionDueAt}
                  metAt={issue.resolvedAt}
                  open={isIssueOpen(issue)}
                />
              ),
            },
            dateTimeColumn('Reported', 'createdAt', 150),
          ]}
        />
      </TableCard>
      {reporting && <ReportIssueModal onClose={() => setReporting(false)} />}
    </>
  );
}
