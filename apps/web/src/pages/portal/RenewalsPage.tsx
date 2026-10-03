import { ClockCircleOutlined, StopOutlined, SyncOutlined } from '@ant-design/icons';
import { Button, Tag } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { PolicySummary } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { DataTable, dateColumn, moneyColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { ErrorAlert } from '../../components/ErrorAlert';
import { KpiGrid, KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { PolicyLink } from '../../components/sales/PolicyTable';
import { useSalesLinks } from '../../components/sales/useSalesLinks';
import { TableCard } from '../../components/TableCard';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

function daysLeft(endDate: string | null): number | null {
  return endDate ? dayjs(endDate).startOf('day').diff(dayjs().startOf('day'), 'day') : null;
}

function ExpiryTag({ endDate }: { endDate: string | null }) {
  const days = daysLeft(endDate);
  if (days === null) return null;
  if (days < 0)
    return (
      <Tag variant="filled" className="status-tag">
        Expired {-days} day{days === -1 ? '' : 's'} ago
      </Tag>
    );
  return (
    <Tag variant="filled" color={days <= 7 ? 'orange' : 'gold'} className="status-tag">
      {days === 0 ? 'Expires today' : `${days} day${days === 1 ? '' : 's'} left`}
    </Tag>
  );
}

/** AP-26: active and recently expired renewable policies whose cover ends soon. */
export default function RenewalsPage() {
  const navigate = useNavigate();
  const links = useSalesLinks();
  const { can } = useAuth();
  const policies = usePagedQuery<PolicySummary>('/portal/policies/renewals-due', {}, 50);
  const renew = useApiMutation(
    (id: string) => api.post<{ id: string }>(`/portal/policies/${id}/renew`),
    {
      success: 'Renewal quotation created',
      invalidate: ['/portal/policies', '/portal/dashboard'],
      onSuccess: (created) => navigate(`/portal/policies/${created.id}`),
    },
  );
  const canRenew = can(P.portalPoliciesService);
  const days = policies.items.map((policy) => daysLeft(policy.endDate));
  const expiringSoon = days.filter((value) => value !== null && value >= 0 && value <= 7).length;
  const expired = days.filter((value) => value !== null && value < 0).length;

  return (
    <>
      <PageHeader
        title="Renewals"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Renewals' }]}
      />
      <ErrorAlert error={renew.error} className="mb-16" />
      <KpiGrid columns={3}>
        <KpiTile
          label="Due for renewal"
          icon={<SyncOutlined />}
          value={policies.pagination.total}
        />
        <KpiTile
          label="Expiring within 7 days"
          icon={<ClockCircleOutlined />}
          value={expiringSoon}
          tone={expiringSoon > 0 ? 'warning' : 'default'}
        />
        <KpiTile
          label="Expired"
          icon={<StopOutlined />}
          value={expired}
          sub="Still renewable"
          tone={expired > 0 ? 'danger' : 'default'}
        />
      </KpiGrid>
      <TableCard>
        <DataTable<PolicySummary>
          rowKey="id"
          loading={policies.isFetching}
          dataSource={policies.items}
          pagination={policies.pagination}
          scroll={{}}
          onRowClick={(policy) => navigate(links.policy(policy.id))}
          locale={{ emptyText: <EmptyState label="No renewals due" /> }}
          columns={[
            {
              title: 'Policy no.',
              key: 'reference',
              width: 155,
              render: (_, policy) => <PolicyLink policy={policy} />,
            },
            textColumn('Product', ['product', 'name']),
            textColumn('Participant', ['participant', 'fullName'], 160),
            ...(can(P.portalAgencyWideView)
              ? [textColumn<PolicySummary>('Agent', ['agent', 'fullName'], 140)]
              : []),
            dateColumn('Cover ends', 'endDate', 110),
            {
              title: 'Due',
              key: 'due',
              width: 140,
              render: (_, policy) => <ExpiryTag endDate={policy.endDate} />,
            },
            moneyColumn('Contribution', 'contribution', 120),
            ...(canRenew
              ? [
                  {
                    key: 'renew',
                    align: 'right' as const,
                    width: 100,
                    render: (_: unknown, policy: PolicySummary) => (
                      <Button
                        size="small"
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
      </TableCard>
    </>
  );
}
