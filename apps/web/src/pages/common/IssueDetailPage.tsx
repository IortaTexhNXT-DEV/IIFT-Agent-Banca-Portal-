import { Alert, Card, Col, Descriptions, Flex, Row, Typography } from 'antd';
import { useParams } from 'react-router';
import { useApiQuery } from '../../api/hooks';
import type { Issue } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { IssueManagement, ReporterActions, StatusChangeButton } from '../../components/admin/IssueActions';
import { IssueComments } from '../../components/admin/IssueComments';
import { isIssueOpen, issueUploadTypes, SlaBreachedTag, SlaDue } from '../../components/admin/issues';
import { basePathFor } from '../../components/admin/links';
import { useCodes } from '../../components/admin/useCodes';
import { DocumentPanel } from '../../components/DocumentPanel';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime } from '../../utils/format';
import { P } from '../../utils/permissions';

function IssueFacts({ issue, categoryLabel }: { issue: Issue; categoryLabel: string }) {
  const open = isIssueOpen(issue);
  return (
    <Descriptions
      size="small"
      column={{ xs: 1, md: 2 }}
      items={[
        { key: 'category', label: 'Category', children: categoryLabel },
        { key: 'priority', label: 'Priority', children: <StatusTag status={issue.priority} /> },
        { key: 'reporter', label: 'Reported by', children: issue.reportedByName },
        { key: 'reported', label: 'Reported', children: formatDateTime(issue.createdAt) },
        { key: 'assignee', label: 'Assigned to', children: issue.assignedToName ? `${issue.assignedToName}${issue.assignedTeam ? ` · ${issue.assignedTeam}` : ''}` : 'Unassigned' },
        { key: 'responded', label: 'First response', children: formatDateTime(issue.firstRespondedAt) },
        { key: 'responseDue', label: 'Response due', children: <SlaDue due={issue.responseDueAt} metAt={issue.firstRespondedAt} open={open} /> },
        { key: 'resolutionDue', label: 'Resolution due', children: <SlaDue due={issue.resolutionDueAt} metAt={issue.resolvedAt} open={open} /> },
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
            title={
              <Flex gap={12} align="center" wrap>
                {data.issueNo}
                <StatusTag status={data.status} />
                <SlaBreachedTag issue={data} />
              </Flex>
            }
            subtitle={data.title}
            breadcrumb={[{ title: manager ? 'Issues' : 'Support', to: `${base}/issues` }, { title: data.issueNo }]}
            extra={manager ? <StatusChangeButton issue={data} /> : <ReporterActions issue={data} />}
          />
          {data.status === 'RESOLVED' && !manager && (
            <Alert className="mb-16" type="success" showIcon title="Support has resolved this issue" description="Confirm and close it if the problem is fixed, or reopen it if it is not." />
          )}
          <Row gutter={16}>
            <Col xs={24} xl={manager ? 16 : 24}>
              <Card title="Details" className="content-card">
                <Typography.Paragraph className="issue-description">{data.description}</Typography.Paragraph>
                <IssueFacts issue={data} categoryLabel={categories.labelOf(data.category)} />
                {data.resolution && <Alert className="issue-resolution" type="success" title="Resolution" description={data.resolution} />}
              </Card>
              <Card className="content-card">
                <DocumentPanel ownerType="ISSUE" ownerId={data.id} canUpload={data.status !== 'CLOSED'} uploadTypes={issueUploadTypes(documentTypes.labelOf)} title="Attachments" />
              </Card>
              <Card title="Conversation" className="content-card">
                <IssueComments issue={data} canAddInternal={manager} />
              </Card>
            </Col>
            {manager && (
              <Col xs={24} xl={8}>
                <Card title="Assignment & priority" className="content-card">
                  <IssueManagement issue={data} />
                </Card>
              </Col>
            )}
          </Row>
        </>
      )}
    </QueryState>
  );
}
