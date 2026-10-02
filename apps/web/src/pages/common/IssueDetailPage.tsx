import { Alert, Card, Col, Row } from 'antd';
import { useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { Issue } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { IssueActions, ReporterActions } from '../../components/admin/IssueActions';
import { IssueComments } from '../../components/admin/IssueComments';
import {
  isIssueOpen,
  issueUploadTypes,
  SlaBreachedTag,
  SlaDue,
} from '../../components/admin/issues';
import { basePathFor } from '../../components/admin/links';
import { useCodes } from '../../components/admin/useCodes';
import { DocumentPanel } from '../../components/DocumentPanel';
import { FieldGrid } from '../../components/FieldGrid';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime, humanise } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/admin.css';

function IssueFacts({ issue, categoryLabel }: { issue: Issue; categoryLabel: string }) {
  return (
    <FieldGrid
      columns={4}
      items={[
        { key: 'title', label: 'Title', value: issue.title, span: 2 },
        { key: 'category', label: 'Category', value: categoryLabel },
        { key: 'priority', label: 'Priority', value: <StatusTag status={issue.priority} /> },
        { key: 'reporter', label: 'Reported by', value: issue.reportedByName },
        { key: 'reported', label: 'Reported', value: formatDateTime(issue.createdAt) },
        {
          key: 'assignee',
          label: 'Assigned to',
          value: issue.assignedToName ?? <span className="muted">Unassigned</span>,
        },
        { key: 'team', label: 'Team', value: issue.assignedTeam },
        {
          key: 'description',
          label: 'Description',
          value: <p className="issue-description">{issue.description}</p>,
          span: 'full',
        },
        issue.resolution && {
          key: 'resolution',
          label: 'Resolution',
          value: <p className="issue-description">{issue.resolution}</p>,
          span: 'full',
        },
      ]}
    />
  );
}

function ServiceLevel({ issue }: { issue: Issue }) {
  const open = isIssueOpen(issue);
  return (
    <FieldGrid
      columns={1}
      items={[
        {
          key: 'responseDue',
          label: 'Response due',
          value: <SlaDue due={issue.responseDueAt} metAt={issue.firstRespondedAt} open={open} />,
        },
        {
          key: 'responded',
          label: 'First response',
          value: formatDateTime(issue.firstRespondedAt),
        },
        {
          key: 'resolutionDue',
          label: 'Resolution due',
          value: <SlaDue due={issue.resolutionDueAt} metAt={issue.resolvedAt} open={open} />,
        },
        { key: 'resolved', label: 'Resolved', value: formatDateTime(issue.resolvedAt) },
      ]}
    />
  );
}

/** AP-55..57, BO-29..31: issue details, SLA, conversation, attachments and handling. */
export default function IssueDetailPage() {
  const { id = '' } = useParams();
  const { user, can } = useAuth();
  const categories = useCodes('ISSUE_CATEGORY');
  const documentTypes = useCodes('DOCUMENT_TYPE');
  const issue = useApiQuery<Issue>(`/common/issues/${id}`);
  const base = basePathFor(user?.audience ?? 'PORTAL');
  const manager = user?.audience === 'BACKOFFICE' && can(P.boIssuesManage);

  return (
    <QueryState query={issue}>
      {(data) => (
        <>
          <PageHeader
            title={data.issueNo}
            tags={
              <>
                <StatusTag status={data.status} />
                <SlaBreachedTag issue={data} />
              </>
            }
            meta={[
              { label: 'Priority', value: humanise(data.priority) },
              { label: 'Category', value: categories.labelOf(data.category) },
              { label: 'Reported', value: formatDateTime(data.createdAt) },
            ]}
            breadcrumb={[
              { title: 'Home', to: base },
              { title: manager ? 'Issues' : 'Support', to: `${base}/issues` },
              { title: data.issueNo },
            ]}
          />
          {data.status === 'RESOLVED' && !manager && (
            <Alert
              className="mb-16"
              type="success"
              showIcon
              title="Resolved by support – confirm and close, or reopen if the problem remains"
            />
          )}
          <Row gutter={16}>
            <Col xs={24} xl={16}>
              <Card title="Details" className="content-card">
                <IssueFacts issue={data} categoryLabel={categories.labelOf(data.category)} />
                {manager ? <IssueActions issue={data} /> : <ReporterActions issue={data} />}
              </Card>
              <Card className="content-card">
                <DocumentPanel
                  ownerType="ISSUE"
                  ownerId={data.id}
                  canUpload={data.status !== 'CLOSED'}
                  uploadTypes={issueUploadTypes(documentTypes.labelOf)}
                  title="Attachments"
                />
              </Card>
              <Card title="Conversation" className="content-card">
                <IssueComments issue={data} canAddInternal={manager} />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="Service level" className="content-card">
                <ServiceLevel issue={data} />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </QueryState>
  );
}
