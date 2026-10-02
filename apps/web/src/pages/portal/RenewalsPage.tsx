import { Button, Card, Table, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { Money as MoneyValue, PolicySummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { PolicyLink } from '../../components/sales/PolicyTable';
import { formatDate } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

function ExpiryTag({ endDate }: { endDate: string | null }) {
  if (!endDate) return null;
  const days = dayjs(endDate).startOf('day').diff(dayjs().startOf('day'), 'day');
  if (days < 0)
    return (
      <Tag variant="filled">
        Expired {-days} day{days === -1 ? '' : 's'} ago
      </Tag>
    );
  return (
    <Tag variant="filled" color={days <= 7 ? 'orange' : 'gold'}>
      {days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}
    </Tag>
  );
}

/** AP-26: active and recently expired renewable policies whose cover ends soon. */
export default function RenewalsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const policies = usePagedQuery<PolicySummary>('/portal/policies/renewals-due');
  const renew = useApiMutation(
    (id: string) => api.post<{ id: string }>(`/portal/policies/${id}/renew`),
    {
      success: 'Renewal quotation created',
      invalidate: ['/portal/policies', '/portal/dashboard'],
      onSuccess: (created) => navigate(`/portal/policies/${created.id}`),
    },
  );
  const canRenew = can(P.portalPoliciesService);

  return (
    <>
      <PageHeader
        title="Renewals"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Renewals' }]}
      />
      <ErrorAlert error={renew.error} className="mb-16" />
      <Card className="content-card" styles={{ body: { padding: 0 } }}>
        <Table<PolicySummary>
          size="middle"
          rowKey="id"
          loading={policies.isFetching}
          dataSource={policies.items}
          pagination={policies.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No renewals due' }}
          columns={[
            {
              title: 'Policy no.',
              key: 'reference',
              render: (_, policy) => <PolicyLink policy={policy} />,
            },
            { title: 'Product', dataIndex: ['product', 'name'] },
            { title: 'Participant', dataIndex: ['participant', 'fullName'] },
            ...(can(P.portalAgencyWideView)
              ? [{ title: 'Agent', dataIndex: ['agent', 'fullName'] }]
              : []),
            { title: 'Cover ends', dataIndex: 'endDate', render: formatDate },
            {
              title: 'Due',
              key: 'due',
              render: (_, policy) => <ExpiryTag endDate={policy.endDate} />,
            },
            {
              title: 'Contribution',
              dataIndex: 'contribution',
              align: 'right',
              render: (value: MoneyValue) => <Money value={value} />,
            },
            ...(canRenew
              ? [
                  {
                    key: 'renew',
                    align: 'right' as const,
                    fixed: 'right' as const,
                    render: (_: unknown, policy: PolicySummary) => (
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        loading={renew.isPending && renew.variables === policy.id}
                        onClick={() => renew.mutate(policy.id)}
                      >
                        Renew
                      </Button>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
    </>
  );
}
