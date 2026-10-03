import { EditOutlined, UnlockOutlined } from '@ant-design/icons';
import { Button, Card, Col, Row } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery, usePagedQuery } from '../../api/hooks';
import type { Agency, AgentView } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencyFormModal } from '../../components/admin/AgencyFormModal';
import { AgencySummary, IssuanceBlockAlert } from '../../components/admin/AgencySummary';
import { AGENT_TYPE_LABELS, CHANNEL_LABELS } from '../../components/admin/agents';
import { RemarksModal } from '../../components/admin/RemarksModal';
import { DataTable, dateColumn, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { TableCard } from '../../components/TableCard';
import { P } from '../../utils/permissions';

function AgencyAgents({ agencyId, banca }: { agencyId: string; banca: boolean }) {
  const navigate = useNavigate();
  const agents = usePagedQuery<AgentView>('/backoffice/agents', { agencyId });
  const columns: ColumnsType<AgentView> = [
    {
      title: 'Agent code',
      dataIndex: 'agentCode',
      width: 120,
      render: (code: string, agent) => <Link to={`/backoffice/agents/${agent.id}`}>{code}</Link>,
    },
    textColumn('Name', 'fullName'),
    {
      title: 'Type',
      dataIndex: 'agentType',
      width: 120,
      render: (type: AgentView['agentType']) => AGENT_TYPE_LABELS[type],
    },
    textColumn('Reports to', ['parent', 'fullName'], 170),
    statusColumn('Status', 'status', 120),
    statusColumn('AML', 'amlStatus', 110),
    dateColumn('Licence expiry', 'licenceExpiry', 130),
  ];
  return (
    <TableCard title={banca ? 'Bank officers' : 'Agents'}>
      <DataTable<AgentView>
        rowKey="id"
        loading={agents.isFetching}
        dataSource={agents.items}
        pagination={agents.pagination}
        columns={columns}
        onRowClick={(agent) => navigate(`/backoffice/agents/${agent.id}`)}
        locale={{ emptyText: <EmptyState label="No agents yet" /> }}
      />
    </TableCard>
  );
}

/** BO-09: agency or bank details, payment block override and its agents. */
export default function AgencyDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const agency = useApiQuery<Agency>(`/backoffice/agencies/${id}`);
  const [dialog, setDialog] = useState<'edit' | 'lift'>();
  const liftBlock = useApiMutation(
    (reason: string) => api.post<Agency>(`/backoffice/agencies/${id}/lift-block`, { reason }),
    {
      success: 'Issuance block lifted',
      invalidate: ['/backoffice/agencies', '/backoffice/dashboard'],
      onSuccess: () => setDialog(undefined),
    },
  );

  return (
    <QueryState query={agency}>
      {(data) => {
        const banca = data.channel === 'BANCA';
        return (
          <>
            <PageHeader
              title={data.name}
              tags={<StatusTag status={data.status} />}
              meta={[
                { label: 'Code', value: data.code },
                { label: 'Channel', value: CHANNEL_LABELS[data.channel] },
                data.registrationNo && { label: 'Registration no.', value: data.registrationNo },
              ]}
              breadcrumb={[
                { title: 'Home', to: '/backoffice' },
                { title: 'Agencies & banks', to: '/backoffice/agencies' },
                { title: data.code },
              ]}
              extra={
                can(P.boAgenciesManage) && (
                  <>
                    {data.issuanceBlocked && (
                      <Button icon={<UnlockOutlined />} onClick={() => setDialog('lift')}>
                        Lift block
                      </Button>
                    )}
                    <Button
                      type="primary"
                      icon={<EditOutlined />}
                      onClick={() => setDialog('edit')}
                    >
                      Edit
                    </Button>
                  </>
                )
              }
            />
            <IssuanceBlockAlert agency={data} />
            <Row gutter={16}>
              <Col xs={24} xl={16}>
                <Card title="Details" className="content-card">
                  <AgencySummary agency={data} fields="details" />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card title="Agents & contributions" className="content-card">
                  <AgencySummary agency={data} fields="activity" columns={2} />
                </Card>
              </Col>
            </Row>
            <AgencyAgents agencyId={data.id} banca={banca} />
            {dialog === 'edit' && (
              <AgencyFormModal agency={data} onClose={() => setDialog(undefined)} />
            )}
            {dialog === 'lift' && (
              <RemarksModal
                title={`Lift issuance block – ${data.code}`}
                okText="Lift block"
                label="Reason"
                required
                maxLength={300}
                description="For contributions settled outside the portal; the daily check blocks the agency again while contributions stay overdue."
                pending={liftBlock.isPending}
                error={liftBlock.error}
                onSubmit={(reason) => liftBlock.mutate(reason)}
                onClose={() => setDialog(undefined)}
              />
            )}
          </>
        );
      }}
    </QueryState>
  );
}
