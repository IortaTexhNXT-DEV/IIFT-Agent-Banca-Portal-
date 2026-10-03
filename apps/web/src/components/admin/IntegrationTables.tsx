import { RedoOutlined } from '@ant-design/icons';
import { Button, Select, Tooltip } from 'antd';
import type { ReactNode } from 'react';
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
import { formatDateTime, formatNumber, humanise } from '../../utils/format';
import {
  DataTable,
  dateColumn,
  dateTimeColumn,
  moneyColumn,
  statusColumn,
  textColumn,
} from '../DataTable';
import { ErrorAlert } from '../ErrorAlert';
import { StatusTag } from '../StatusTag';
import { TableCard } from '../TableCard';
import { recordPath } from './links';
import { enumOptions } from './useCodes';
import '../../styles/admin.css';

export const SYSTEM_LABELS: Record<IntegrationSystem, string> = {
  CORE: 'Core system',
  FINANCE: 'Finance (FIN)',
  AML: 'AML screening',
  EMAIL: 'E-mail',
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
  <pre className="json-block json-block--fixed">{JSON.stringify(message.payload, null, 2)}</pre>
);

function SystemFilter({ onChange }: { onChange(system?: IntegrationSystem): void }) {
  return (
    <Select
      allowClear
      placeholder="System"
      aria-label="System"
      className="filter-select"
      options={SYSTEM_OPTIONS}
      onChange={onChange}
    />
  );
}

/** INT-13/14: outbound message queue with re-submission of failed and dead-lettered messages. */
export function OutboxTable({ actions }: { actions?: ReactNode }) {
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
      <ErrorAlert error={retry.error} className="mb-16" />
      <TableCard
        toolbar={
          <>
            <SystemFilter onChange={(system) => update({ system })} />
            <Select
              allowClear
              placeholder="Status"
              aria-label="Status"
              className="filter-select"
              options={enumOptions(OUTBOX_STATUSES, humanise)}
              onChange={(status?: OutboxStatus) => update({ status })}
            />
          </>
        }
        actions={actions}
      >
        <DataTable<OutboxMessage>
          rowKey="id"
          loading={messages.isFetching}
          dataSource={messages.items}
          pagination={messages.pagination}
          locale={{ emptyText: 'No messages' }}
          expandable={{ expandedRowRender: renderPayload, columnWidth: 40 }}
          columns={[
            dateTimeColumn('Created', 'createdAt', 150),
            { title: 'System', dataIndex: 'system', width: 120, render: systemLabel },
            {
              title: 'Operation',
              dataIndex: 'operation',
              width: 160,
              ellipsis: true,
              render: humanise,
            },
            {
              title: 'Record',
              key: 'aggregate',
              width: 110,
              render: (_: unknown, row) => {
                const path = recordPath('BACKOFFICE', row.aggregateType, row.aggregateId);
                return path ? (
                  <Link to={path}>{row.aggregateType}</Link>
                ) : (
                  (row.aggregateType ?? '–')
                );
              },
            },
            statusColumn('Status', 'status', 90),
            { title: 'Attempts', dataIndex: 'attempts', width: 90, align: 'right' },
            {
              title: 'Next attempt',
              dataIndex: 'nextAttemptAt',
              width: 150,
              render: (value: string, row) =>
                row.status === 'PENDING' || row.status === 'FAILED' ? formatDateTime(value) : '–',
            },
            dateTimeColumn('Delivered', 'processedAt', 150),
            textColumn('Last error', 'lastError'),
            {
              key: 'actions',
              width: 48,
              fixed: messages.items.some((row) => RETRYABLE.includes(row.status))
                ? 'right'
                : undefined,
              align: 'right',
              render: (_: unknown, row) =>
                RETRYABLE.includes(row.status) && (
                  <Tooltip title="Re-submit">
                    <Button
                      type="text"
                      size="small"
                      icon={<RedoOutlined />}
                      aria-label="Re-submit message"
                      loading={retry.isPending && retry.variables === row.id}
                      onClick={() => retry.mutate(row.id)}
                    />
                  </Tooltip>
                ),
            },
          ]}
        />
      </TableCard>
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
    <TableCard
      toolbar={
        <>
          <SystemFilter onChange={(system) => update({ system })} />
          <Select
            allowClear
            placeholder="Result"
            aria-label="Result"
            className="filter-select"
            options={[
              { value: 'true', label: 'Successful' },
              { value: 'false', label: 'Failed' },
            ]}
            onChange={(value?: string) =>
              update({ success: value === undefined ? undefined : value === 'true' })
            }
          />
        </>
      }
    >
      <DataTable<IntegrationLogEntry>
        rowKey="id"
        loading={logs.isFetching}
        dataSource={logs.items}
        pagination={logs.pagination}
        locale={{ emptyText: 'No calls' }}
        columns={[
          dateTimeColumn('Time', 'createdAt', 150),
          { title: 'System', dataIndex: 'system', width: 120, render: systemLabel },
          { title: 'Operation', dataIndex: 'operation', width: 160, render: humanise },
          { title: 'Direction', dataIndex: 'direction', width: 90, render: humanise },
          {
            title: 'Result',
            dataIndex: 'success',
            width: 100,
            render: (success: boolean) => (
              <StatusTag
                tone={success ? 'positive' : 'negative'}
                label={success ? 'Successful' : 'Failed'}
              />
            ),
          },
          {
            title: 'Duration',
            dataIndex: 'durationMs',
            width: 90,
            align: 'right',
            render: (ms: number) => `${formatNumber(ms)} ms`,
          },
          textColumn('Reference', 'reference', 140),
          textColumn('Request', 'requestSummary'),
          textColumn('Error', 'errorMessage', 200),
        ]}
      />
    </TableCard>
  );
}

/** INT-15: daily matching of receipts issued against postings confirmed by Finance. */
export function ReconciliationTable({ actions }: { actions?: ReactNode }) {
  const runs = usePagedQuery<ReconciliationRun>('/backoffice/integration/reconciliations');
  return (
    <TableCard title="Runs" extra={actions}>
      <DataTable<ReconciliationRun>
        rowKey="id"
        loading={runs.isFetching}
        dataSource={runs.items}
        pagination={runs.pagination}
        locale={{ emptyText: 'No reconciliation runs' }}
        columns={[
          dateColumn('Business date', 'businessDate', 130),
          { title: 'System', dataIndex: 'system', width: 130, render: systemLabel },
          statusColumn('Status', 'status', 110),
          {
            title: 'Receipts matched',
            key: 'count',
            width: 140,
            align: 'right',
            render: (_: unknown, row) =>
              `${formatNumber(row.matchedCount)} of ${formatNumber(row.expectedCount)}`,
          },
          moneyColumn('Expected', 'expectedAmount', 140),
          moneyColumn('Matched', 'matchedAmount', 140),
          {
            ...textColumn<ReconciliationRun>('Unmatched receipts', 'details'),
            render: (details: ReconciliationRun['details']) => {
              const text = details?.unmatchedReceipts?.join(', ');
              return text ? (
                <Tooltip title={text} placement="topLeft">
                  {text}
                </Tooltip>
              ) : (
                '–'
              );
            },
          },
          dateTimeColumn('Run at', 'createdAt', 160),
        ]}
      />
    </TableCard>
  );
}
