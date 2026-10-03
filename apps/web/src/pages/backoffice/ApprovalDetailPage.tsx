import { Alert, Button, Card, Col, Popconfirm, Row } from 'antd';
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
import { FieldGrid } from '../../components/FieldGrid';
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
          <FieldGrid
            columns={3}
            className="mb-16"
            items={[
              {
                key: 'agent',
                label: 'Agent',
                value: (
                  <Link to={`/backoffice/agents/${data.id}`}>
                    {data.fullName} ({data.agentCode})
                  </Link>
                ),
              },
              { key: 'status', label: 'Agent status', value: <StatusTag status={data.status} /> },
              { key: 'aml', label: 'AML status', value: <StatusTag status={data.amlStatus} /> },
            ]}
          />
          {data.amlStatus === 'FLAGGED' && (
            <Alert
              className="mb-16"
              type="warning"
              showIcon
              title="AML screening flagged a possible match – clearance required before approval"
              action={
                <Link to="/backoffice/aml">
                  <Button size="small">AML / KYC</Button>
                </Link>
              }
            />
          )}
          {data.amlStatus === 'REJECTED' && data.status === 'PENDING' && (
            <Alert
              className="mb-16"
              type="error"
              showIcon
              title="Watch-list match confirmed by Compliance – reject this request"
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
              title={data.requestNo}
              tags={<StatusTag status={data.status} />}
              meta={[
                { label: 'Type', value: humanise(data.type) },
                pending && {
                  label: 'Level',
                  value: `${data.currentLevel} of ${data.totalLevels}`,
                },
                { label: 'Submitted by', value: data.makerName },
              ]}
              breadcrumb={[
                { title: 'Home', to: '/backoffice' },
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
                      title={`Withdraw ${data.requestNo}?`}
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
                title="Submitted by you – another approver decides this request."
              />
            )}
            {pending && !isMaker && !canDecide && (
              <Alert
                className="mb-16"
                type="info"
                showIcon
                title={`Awaiting an approver at level ${data.currentLevel}.`}
              />
            )}
            <RejectionAlert request={data} />
            <Row gutter={16}>
              <Col xs={24} xl={16}>
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
              </Col>
              <Col xs={24} xl={8}>
                <Card title="Approval history" className="content-card">
                  <ApprovalHistory approvals={[data]} compact />
                </Card>
              </Col>
            </Row>
          </>
        );
      }}
    </QueryState>
  );
}
