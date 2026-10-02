import { EditOutlined, UnlockOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Table } from 'antd';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery, usePagedQuery } from '../../api/hooks';
import type { Agency, AgentView } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgencyFormModal } from '../../components/admin/AgencyFormModal';
import { AgencySummary, IssuanceBlockAlert } from '../../components/admin/AgencySummary';
import { AGENT_TYPE_LABELS } from '../../components/admin/agents';
import { RemarksModal } from '../../components/admin/RemarksModal';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { formatDate } from '../../utils/format';
import { P } from '../../utils/permissions';

function AgencyAgents({ agencyId }: { agencyId: string }) {
  const agents = usePagedQuery<AgentView>('/backoffice/agents', { agencyId });
  return (
    <Table<AgentView>
      size="small"
      rowKey="id"
      loading={agents.isFetching}
      dataSource={agents.items}
      pagination={agents.pagination}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No agents registered' }}
      columns={[
        { title: 'Agent code', dataIndex: 'agentCode', render: (code: string, agent) => <Link to={`/backoffice/agents/${agent.id}`}>{code}</Link> },
        { title: 'Name', dataIndex: 'fullName' },
        { title: 'Type', dataIndex: 'agentType', render: (type: AgentView['agentType']) => AGENT_TYPE_LABELS[type] },
        { title: 'Reports to', key: 'parent', render: (_: unknown, agent) => agent.parent?.fullName ?? '–' },
        { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
        { title: 'AML', dataIndex: 'amlStatus', render: (status: string) => <StatusTag status={status} /> },
        { title: 'Licence expiry', dataIndex: 'licenceExpiry', render: formatDate },
      ]}
    />
  );
}

/** BO-09: agency or bank details, payment block override and its agents. */
export default function AgencyDetailPage() {
  const { id = '' } = useParams();
  const { can } = useAuth();
  const agency = useApiQuery<Agency>(`/backoffice/agencies/${id}`);
  const [dialog, setDialog] = useState<'edit' | 'lift'>();
  const liftBlock = useApiMutation((reason: string) => api.post<Agency>(`/backoffice/agencies/${id}/lift-block`, { reason }), {
    success: 'Issuance block lifted',
    invalidate: ['/backoffice/agencies', '/backoffice/dashboard'],
    onSuccess: () => setDialog(undefined),
  });

  return (
    <QueryState query={agency}>
      {(data) => (
        <>
          <PageHeader
            title={
              <Flex gap={12} align="center" wrap>
                {data.name}
                <StatusTag status={data.status} />
              </Flex>
            }
            subtitle={data.code}
            breadcrumb={[{ title: 'Agencies & banks', to: '/backoffice/agencies' }, { title: data.code }]}
            extra={
              can(P.boAgenciesManage) && (
                <>
                  {data.issuanceBlocked && (
                    <Button icon={<UnlockOutlined />} onClick={() => setDialog('lift')}>
                      Lift block
                    </Button>
                  )}
                  <Button type="primary" icon={<EditOutlined />} onClick={() => setDialog('edit')}>
                    Edit
                  </Button>
                </>
              )
            }
          />
          <IssuanceBlockAlert agency={data} />
          <Card title="Details" className="content-card">
            <AgencySummary agency={data} />
          </Card>
          <Card title="Agents and bank officers" className="content-card">
            <AgencyAgents agencyId={data.id} />
          </Card>
          {dialog === 'edit' && <AgencyFormModal agency={data} onClose={() => setDialog(undefined)} />}
          {dialog === 'lift' && (
            <RemarksModal
              title={`Lift issuance block – ${data.code}`}
              okText="Lift block"
              label="Reason"
              required
              maxLength={300}
              description="Use this when contributions were settled outside the portal. The daily check blocks the agency again if contributions are still overdue."
              pending={liftBlock.isPending}
              error={liftBlock.error}
              onSubmit={(reason) => liftBlock.mutate(reason)}
              onClose={() => setDialog(undefined)}
            />
          )}
        </>
      )}
    </QueryState>
  );
}
