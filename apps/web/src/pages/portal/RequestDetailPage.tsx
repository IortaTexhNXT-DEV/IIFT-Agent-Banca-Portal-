import { Button, Card, Col, Popconfirm, Row } from 'antd';
import { useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ApprovalRequest } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { recordPath } from '../../components/admin/links';
import { PayloadView } from '../../components/admin/PayloadView';
import { RejectionAlert, RequestSummary } from '../../components/admin/RequestSummary';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime, humanise } from '../../utils/format';

/** AP-49..51: status, submitted details, decisions and remarks of one request. */
export default function RequestDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const request = useApiQuery<ApprovalRequest>(`/portal/requests/${id}`);
  const withdraw = useApiMutation(
    () => api.post<ApprovalRequest>(`/portal/requests/${id}/withdraw`),
    {
      success: 'Request withdrawn',
      invalidate: ['/portal'],
    },
  );

  return (
    <QueryState query={request}>
      {(data) => {
        const record = recordPath('PORTAL', data.entityType, data.entityId);
        return (
          <>
            <PageHeader
              title={data.requestNo}
              tags={<StatusTag status={data.status} />}
              meta={[
                { label: 'Type', value: humanise(data.type) },
                { label: 'Submitted', value: formatDateTime(data.submittedAt) },
                data.status === 'PENDING' && {
                  label: 'Level',
                  value: `${data.currentLevel} of ${data.totalLevels}`,
                },
              ]}
              breadcrumb={[
                { title: 'Home', to: '/portal' },
                { title: 'My requests', to: '/portal/requests' },
                { title: data.requestNo },
              ]}
              extra={
                <>
                  {record && (
                    <Button onClick={() => navigate(record)}>
                      Open {data.entityType.toLowerCase()}
                    </Button>
                  )}
                  {data.status === 'PENDING' && data.makerId === user?.id && (
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
                </>
              }
            />
            <ErrorAlert error={withdraw.error} className="mb-16" />
            <RejectionAlert request={data} />
            <Row gutter={16}>
              <Col xs={24} xl={16}>
                <Card title="Request" className="content-card">
                  <RequestSummary request={data} />
                </Card>
                <Card title="Submitted details" className="content-card">
                  <PayloadView payload={data.payload} />
                </Card>
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
