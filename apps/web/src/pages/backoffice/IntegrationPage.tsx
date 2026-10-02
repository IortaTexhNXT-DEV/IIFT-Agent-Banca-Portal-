import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Tabs } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { IntegrationSummary, ReconciliationRun } from '../../api/admin-types';
import { BusinessDateModal } from '../../components/admin/BusinessDateModal';
import {
  IntegrationLogTable,
  OutboxTable,
  ReconciliationTable,
  SYSTEM_LABELS,
} from '../../components/admin/IntegrationTables';
import { KpiGrid, KpiTile, type KpiTone } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { formatNumber } from '../../utils/format';

const SUMMARY_REFRESH_MS = 60_000;
const TABS = ['outbox', 'log', 'reconciliation'] as const;
type Tab = (typeof TABS)[number];

function tone(system: IntegrationSummary): KpiTone {
  if (system.deadLetter > 0) return 'danger';
  if (system.retrying > 0) return 'warning';
  return 'default';
}

function queueHint(system: IntegrationSummary): string {
  const calls = formatNumber(system.successCount + system.failureCount);
  return `${calls} calls · ${formatNumber(system.pending)} pending · ${formatNumber(system.retrying)} retrying · ${formatNumber(system.deadLetter)} dead`;
}

/** INT-11: success rate and queue state of every connected system. */
function SystemHealth({ summary }: { summary: IntegrationSummary[] }) {
  return (
    <KpiGrid columns={3}>
      {summary.map((system) => (
        <KpiTile
          key={system.system}
          label={SYSTEM_LABELS[system.system]}
          value={system.successRate === null ? '–' : `${system.successRate}%`}
          sub={queueHint(system)}
          tone={tone(system)}
        />
      ))}
    </KpiGrid>
  );
}

function Reconciliation() {
  const [running, setRunning] = useState(false);
  const reconcile = useApiMutation(
    (businessDate: string) =>
      api.post<ReconciliationRun>('/backoffice/integration/reconciliations', { businessDate }),
    {
      success: 'Reconciliation completed',
      invalidate: ['/backoffice/integration'],
      onSuccess: () => setRunning(false),
    },
  );
  return (
    <>
      <ReconciliationTable
        actions={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setRunning(true)}>
            Run reconciliation
          </Button>
        }
      />
      {running && (
        <BusinessDateModal
          title="Run reconciliation"
          okText="Run"
          description="Matches the e-Receipts of the date against confirmed FIN postings"
          pending={reconcile.isPending}
          error={reconcile.error}
          onSubmit={(businessDate) => reconcile.mutate(businessDate)}
          onClose={() => setRunning(false)}
        />
      )}
    </>
  );
}

/** INT-11/13..15: interface health, message queue with retry, call log and reconciliation. */
export default function IntegrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab: Tab = TABS.find((key) => key === requested) ?? 'outbox';
  const summary = useApiQuery<IntegrationSummary[]>('/backoffice/integration/summary', undefined, {
    refetchInterval: SUMMARY_REFRESH_MS,
  });
  return (
    <>
      <PageHeader
        title="Integration"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Integration' }]}
      />
      <QueryState query={summary} rows={2}>
        {(data) => <SystemHealth summary={data} />}
      </QueryState>
      <Tabs
        className="page-tabs"
        activeKey={tab}
        destroyOnHidden
        onChange={(key) => setSearchParams(key === 'outbox' ? {} : { tab: key }, { replace: true })}
        items={[
          { key: 'outbox', label: 'Message queue', children: <OutboxTable /> },
          { key: 'log', label: 'Integration log', children: <IntegrationLogTable /> },
          { key: 'reconciliation', label: 'Reconciliation', children: <Reconciliation /> },
        ]}
      />
    </>
  );
}
