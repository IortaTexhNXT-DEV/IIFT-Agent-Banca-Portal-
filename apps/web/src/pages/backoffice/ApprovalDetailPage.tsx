import { Alert, Button, Card, Descriptions, Flex, Popconfirm } from 'antd';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ApprovalRequestDetail } from '../../api/admin-types';
import type { AgentDetail, ApprovalRequest, DocumentOwnerType } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import { ApprovalDecision } from '../../components/admin/ApprovalDecision';
import { recordPath } from '../../components/admin/links';
import { PayloadView } from '../../components/admin/PayloadView';
import { RejectionAlert, RequestSummary } from '../../components/admin/RequestSummary';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { DocumentPanel } from '../../components/DocumentPanel';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { humanise } from '../../utils/format';
import { P } from '../../utils/permissions';

const DOCUMENT_OWNERS: DocumentOwnerType[] = ['POLICY', 'PAYMENT', 'PARTICIPANT'];

/** Document owner type of the record under approval, when it has documents to review. */
function evidenceOwner(entityType: string): DocumentOwnerType | null {
  const ownerType = entityType.toUpperCase() as DocumentOwnerType;
  return ownerType === 'AGENT' || DOCUMENT_OWNERS.includes(ownerType) ? ownerType : null;
}

/** The agent under approval: AML outcome and documents, which gate a registration. */
function AgentEvidence({ agentId }: { agentId: string }) {
  const { can } = useAuth();
  const agent = useApiQuery<AgentDetail>(`/backoffice/agents/${agentId}`);
  return (
    <QueryState query={agent} rows={3}>
      {(data) => (
        <>
          <Descriptions
            size="small"
            className="mb-16"
            column={{ xs: 1, md: 3 }}
            items={[
              {
                key: 'agent',
                label: 'Agent',
                children: (
                  <Link
                    to={`/backoffice/agents/${data.id}`}
                  >{`${data.fullName} (${data.agentCode})`}</Link>
                ),
              },
              {
                key: 'status',
                label: 'Agent status',
                children: <StatusTag status={data.status} />,
              },
              { key: 'aml', label: 'AML status', children: <StatusTag status={data.amlStatus} /> },
            ]}
          />
          {data.amlStatus === 'FLAGGED' && (
            <Alert
              className="mb-16"
              type="warning"
              showIcon
              title="AML screening flagged a possible match"
              description={
                <>
                  Compliance must clear the case under <Link to="/backoffice/aml">AML / KYC</Link>{' '}
                  before the registration can be approved.
                </>
              }
            />
          )}
          {data.amlStatus === 'REJECTED' && data.status === 'PENDING' && (
            <Alert
              className="mb-16"
              type="error"
              showIcon
              title="Compliance confirmed a watch-list match"
              description="The applicant cannot be onboarded. Reject this request."
            />
          )}
          <AgentDocuments
            agentId={data.id}
            idType={data.idType}
            channel={data.agency.channel}
            canReview={can(P.boDocumentsVerify)}
            checkRequired={data.status === 'PENDING'}
          />
        </>
      )}
    </QueryState>
  );
}

function RecordEvidence({ ownerType, ownerId }: { ownerType: DocumentOwnerType; ownerId: string }) {
  return ownerType === 'AGENT' ? (
    <AgentEvidence agentId={ownerId} />
  ) : (
    <DocumentPanel
      ownerType={ownerType}
      ownerId={ownerId}
      title={`${humanise(ownerType)} documents`}
    />
  );
}

/** BO-16..21: review a request, its evidence and history, and decide it (maker-checker). */
export default function ApprovalDetailPage() {
  const { id = '' } = useParams();
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const request = useApiQuery<ApprovalRequestDetail>(`/backoffice/approvals/${id}`);
  const withdraw = useApiMutation(
    () => api.post<ApprovalRequest>(`/backoffice/approvals/${id}/withdraw`),
    {
      success: 'Request withdrawn',
      invalidate: ['/backoffice'],
    },
  );

  return (
    <QueryState query={request}>
      {(data) => {
        const record = recordPath('BACKOFFICE', data.entityType, data.entityId);
        const evidence = evidenceOwner(data.entityType);
        const pending = data.status === 'PENDING';
        const isMaker = data.makerId === user?.id;
        const alreadyApproved = (data.actions ?? []).some(
          (action) => action.action === 'APPROVE' && action.actorId === user?.id,
        );
        const canDecide =
          pending &&
          !isMaker &&
          !alreadyApproved &&
          can(data.levelPermissions[data.currentLevel - 1] ?? '');
        return (
          <>
            <PageHeader
              title={
                <Flex gap={12} align="center" wrap>
                  {data.requestNo}
                  <StatusTag status={data.status} />
                </Flex>
              }
              subtitle={`${humanise(data.type)}${pending ? ` · level ${data.currentLevel} of ${data.totalLevels}` : ''}`}
              breadcrumb={[
                { title: 'Approvals', to: '/backoffice/approvals' },
                { title: data.requestNo },
              ]}
              extra={
                <>
                  {record && (
                    <Button onClick={() => navigate(record)}>
                      Open {data.entityType.toLowerCase()}
                    </Button>
                  )}
                  {pending && isMaker && (
                    <Popconfirm
                      title="Withdraw this request?"
                      okText="Withdraw"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => withdraw.mutate(undefined)}
                    >
                      <Button danger loading={withdraw.isPending}>
                        Withdraw
                      </Button>
                    </Popconfirm>
                  )}
                  {canDecide && <ApprovalDecision request={data} />}
                </>
              }
            />
            <ErrorAlert error={withdraw.error} className="mb-16" />
            {pending && isMaker && (
              <Alert
                className="mb-16"
                type="info"
                showIcon
                title="You submitted this request, so another approver must decide it."
              />
            )}
            {pending && !isMaker && !canDecide && (
              <Alert
                className="mb-16"
                type="info"
                showIcon
                title="This request is waiting for an approver at its current level; you cannot decide it."
              />
            )}
            <RejectionAlert request={data} />
            <Card title="Request" className="content-card">
              <RequestSummary request={data} />
            </Card>
            <Card title="Submitted details" className="content-card">
              <PayloadView payload={data.payload} />
            </Card>
            {evidence && (
              <Card title="Supporting evidence" className="content-card">
                <RecordEvidence ownerType={evidence} ownerId={data.entityId} />
              </Card>
            )}
            <Card title="Approval history" className="content-card">
              <ApprovalHistory approvals={[data]} />
            </Card>
          </>
        );
      }}
    </QueryState>
  );
}
