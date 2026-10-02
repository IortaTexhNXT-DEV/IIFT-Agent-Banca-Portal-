import { PlayCircleOutlined } from '@ant-design/icons';
import { Button, Col, Flex, Row, Tabs, Typography } from 'antd';
import { useState } from 'react';
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
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatCard } from '../../components/StatCard';
import { formatNumber } from '../../utils/format';

const SUMMARY_REFRESH_MS = 60_000;

function healthHint(system: IntegrationSummary): string {
  const calls =
    system.averageMs === null
      ? 'No calls'
      : `${formatNumber(system.successCount + system.failureCount)} calls, avg ${formatNumber(system.averageMs)} ms`;
  return `${calls} · ${system.pending} pending · ${system.retrying} retrying · ${system.deadLetter} dead`;
}

function SystemHealth({ summary }: { summary: IntegrationSummary[] }) {
  return (
    <Row gutter={[16, 16]} className="mb-16">
      {summary.map((system) => (
        <Col key={system.system} xs={24} md={12} xl={8}>
          <StatCard
            label={SYSTEM_LABELS[system.system]}
            value={system.successRate === null ? '–' : `${system.successRate}%`}
            hint={healthHint(system)}
            tone={system.deadLetter > 0 ? 'danger' : system.retrying > 0 ? 'warning' : 'default'}
          />
        </Col>
      ))}
    </Row>
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
      <Flex justify="flex-end" className="mb-16">
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setRunning(true)}>
          Run reconciliation
        </Button>
      </Flex>
      <ReconciliationTable />
      {running && (
        <BusinessDateModal
          title="Run reconciliation"
          okText="Run"
          description={
            <Typography.Text type="secondary">
              Matches the e-Receipts issued on the date against the postings Finance has confirmed.
            </Typography.Text>
          }
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
  const summary = useApiQuery<IntegrationSummary[]>('/backoffice/integration/summary', undefined, {
    refetchInterval: SUMMARY_REFRESH_MS,
  });
  return (
    <>
      <PageHeader
        title="Integration"
        subtitle="Success rate and response time over the last 24 hours, and messages waiting for delivery"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Integration' }]}
      />
      <QueryState query={summary} rows={2}>
        {(data) => <SystemHealth summary={data} />}
      </QueryState>
      <Tabs
        destroyOnHidden
        items={[
          { key: 'outbox', label: 'Message queue', children: <OutboxTable /> },
          { key: 'log', label: 'Integration log', children: <IntegrationLogTable /> },
          { key: 'reconciliation', label: 'Reconciliation', children: <Reconciliation /> },
        ]}
      />
    </>
  );
}
