import { Button, Card, Select, Table, Tag } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type {
  IntegrationLogEntry,
  IntegrationSystem,
  OutboxMessage,
  OutboxStatus,
  ReconciliationRun,
} from '../../api/admin-types';
import { formatDate, formatDateTime, formatNumber, humanise } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { FilterBar } from '../FilterBar';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { CellText } from './CellText';
import { recordPath } from './links';
import { enumOptions } from './useCodes';
import '../../styles/admin.css';

export const SYSTEM_LABELS: Record<IntegrationSystem, string> = {
  CORE: 'Core system',
  FINANCE: 'Finance (FIN)',
  AML: 'AML screening',
  EMAIL: 'Email',
  SMS: 'SMS gateway',
  DIRECTORY: 'Directory',
};
const SYSTEM_OPTIONS = Object.entries(SYSTEM_LABELS).map(([value, label]) => ({
  value: value as IntegrationSystem,
  label,
}));
const OUTBOX_STATUSES: OutboxStatus[] = ['PENDING', 'SENT', 'FAILED', 'DEAD'];
const RETRYABLE: OutboxStatus[] = ['FAILED', 'DEAD'];
const systemLabel = (system: IntegrationSystem) => SYSTEM_LABELS[system];
const renderPayload = (message: OutboxMessage) => (
  <pre className="json-block">{JSON.stringify(message.payload, null, 2)}</pre>
);

function SystemFilter({ onChange }: { onChange(system?: IntegrationSystem): void }) {
  return (
    <Select
      allowClear
      placeholder="All systems"
      aria-label="System"
      style={{ width: 180 }}
      options={SYSTEM_OPTIONS}
      onChange={onChange}
    />
  );
}

/** INT-13/14: outbound message queue with retry of failed and dead-lettered messages. */
export function OutboxTable() {
  const [filters, setFilters] = useState<{ system?: IntegrationSystem; status?: OutboxStatus }>({});
  const messages = usePagedQuery<OutboxMessage>('/backoffice/integration/outbox', { ...filters });
  const retry = useApiMutation(
    (id: string) => api.post<OutboxMessage>(`/backoffice/integration/outbox/${id}/retry`),
    {
      success: 'Message queued for delivery',
      invalidate: ['/backoffice/integration', '/backoffice/dashboard'],
    },
  );
  const update = (changes: typeof filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    messages.resetPage();
  };

  return (
    <>
      <FilterBar>
        <SystemFilter onChange={(system) => update({ system })} />
        <Select
          allowClear
          placeholder="All statuses"
          aria-label="Status"
          style={{ width: 160 }}
          options={enumOptions(OUTBOX_STATUSES, humanise)}
          onChange={(status?: OutboxStatus) => update({ status })}
        />
      </FilterBar>
      <ErrorAlert error={retry.error} className="mb-16" />
      <Card className="content-card">
        <Table<OutboxMessage>
          size="middle"
          rowKey="id"
          loading={messages.isFetching}
          dataSource={messages.items}
          pagination={messages.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No messages match the filters' }}
          expandable={{ expandedRowRender: renderPayload }}
          columns={[
            { title: 'Created', dataIndex: 'createdAt', render: formatDateTime },
            { title: 'System', dataIndex: 'system', render: systemLabel },
            { title: 'Operation', dataIndex: 'operation', render: humanise },
            {
              title: 'Record',
              key: 'aggregate',
              render: (_: unknown, row) => {
                const path = recordPath('BACKOFFICE', row.aggregateType, row.aggregateId);
                return path ? (
                  <Link to={path}>{row.aggregateType}</Link>
                ) : (
                  (row.aggregateType ?? '–')
                );
              },
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status: string) => <StatusTag status={status} />,
            },
            { title: 'Attempts', dataIndex: 'attempts', align: 'right' },
            {
              title: 'Next attempt',
              dataIndex: 'nextAttemptAt',
              render: (value: string, row) =>
                row.status === 'PENDING' || row.status === 'FAILED' ? formatDateTime(value) : '–',
            },
            { title: 'Delivered', dataIndex: 'processedAt', render: formatDateTime },
            {
              title: 'Last error',
              dataIndex: 'lastError',
              render: (error: string | null) => <CellText text={error} width={260} type="danger" />,
            },
            {
              key: 'actions',
              render: (_: unknown, row) =>
                RETRYABLE.includes(row.status) && (
                  <Button
                    size="small"
                    loading={retry.isPending && retry.variables === row.id}
                    onClick={() => retry.mutate(row.id)}
                  >
                    Retry
                  </Button>
                ),
            },
          ]}
        />
      </Card>
    </>
  );
}

/** INT-11/14: every call to and from external systems, with outcome and duration. */
export function IntegrationLogTable() {
  const [filters, setFilters] = useState<{ system?: IntegrationSystem; success?: boolean }>({});
  const logs = usePagedQuery<IntegrationLogEntry>('/backoffice/integration/logs', { ...filters });
  const update = (changes: typeof filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    logs.resetPage();
  };

  return (
    <>
      <FilterBar>
        <SystemFilter onChange={(system) => update({ system })} />
        <Select
          allowClear
          placeholder="All results"
          aria-label="Result"
          style={{ width: 160 }}
          options={[
            { value: 'true', label: 'Successful' },
            { value: 'false', label: 'Failed' },
          ]}
          onChange={(value?: string) =>
            update({ success: value === undefined ? undefined : value === 'true' })
          }
        />
      </FilterBar>
      <Card className="content-card">
        <Table<IntegrationLogEntry>
          size="middle"
          rowKey="id"
          loading={logs.isFetching}
          dataSource={logs.items}
          pagination={logs.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No integration calls match the filters' }}
          columns={[
            { title: 'Time', dataIndex: 'createdAt', render: formatDateTime },
            { title: 'System', dataIndex: 'system', render: systemLabel },
            { title: 'Operation', dataIndex: 'operation', render: humanise },
            { title: 'Direction', dataIndex: 'direction', render: humanise },
            {
              title: 'Result',
              dataIndex: 'success',
              render: (success: boolean) => (
                <Tag color={success ? 'green' : 'red'} variant="filled">
                  {success ? 'Successful' : 'Failed'}
                </Tag>
              ),
            },
            {
              title: 'Duration',
              dataIndex: 'durationMs',
              align: 'right',
              render: (ms: number) => `${formatNumber(ms)} ms`,
            },
            {
              title: 'Reference',
              dataIndex: 'reference',
              render: (value: string | null) => value ?? '–',
            },
            {
              title: 'Request',
              dataIndex: 'requestSummary',
              render: (value: string | null) => <CellText text={value} width={240} />,
            },
            {
              title: 'Error',
              dataIndex: 'errorMessage',
              render: (value: string | null) => <CellText text={value} width={240} type="danger" />,
            },
          ]}
        />
      </Card>
    </>
  );
}

/** INT-15: daily matching of receipts issued against postings confirmed by Finance. */
export function ReconciliationTable() {
  const runs = usePagedQuery<ReconciliationRun>('/backoffice/integration/reconciliations');
  return (
    <Card className="content-card">
      <Table<ReconciliationRun>
        size="middle"
        rowKey="id"
        loading={runs.isFetching}
        dataSource={runs.items}
        pagination={runs.pagination}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No reconciliation has been run' }}
        columns={[
          { title: 'Business date', dataIndex: 'businessDate', render: formatDate },
          { title: 'System', dataIndex: 'system', render: systemLabel },
          {
            title: 'Status',
            dataIndex: 'status',
            render: (status: string) => <StatusTag status={status} />,
          },
          {
            title: 'Receipts',
            key: 'count',
            align: 'right',
            render: (_: unknown, row) =>
              `${formatNumber(row.matchedCount)} of ${formatNumber(row.expectedCount)}`,
          },
          {
            title: 'Expected amount',
            dataIndex: 'expectedAmount',
            align: 'right',
            render: (value: string) => <Money value={value} />,
          },
          {
            title: 'Matched amount',
            dataIndex: 'matchedAmount',
            align: 'right',
            render: (value: string) => <Money value={value} />,
          },
          {
            title: 'Unmatched receipts',
            key: 'unmatched',
            render: (_: unknown, row) => (
              <CellText text={row.details?.unmatchedReceipts?.join(', ')} width={260} />
            ),
          },
          { title: 'Run at', dataIndex: 'createdAt', render: formatDateTime },
        ]}
      />
    </Card>
  );
}
