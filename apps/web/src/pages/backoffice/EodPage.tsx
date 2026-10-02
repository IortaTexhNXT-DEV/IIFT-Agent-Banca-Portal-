import { DownloadOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { App, Button, Card, Flex, Table, Tooltip, Typography } from 'antd';
import { useState } from 'react';
import { api, download } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { EodRun } from '../../api/admin-types';
import { BusinessDateModal } from '../../components/admin/BusinessDateModal';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { formatDate, formatDateTime, formatNumber } from '../../utils/format';

function FileButton({ documentId, label }: { documentId: string | null; label: string }) {
  const { message } = App.useApp();
  if (!documentId) return null;
  return (
    <Button size="small" icon={<DownloadOutlined />} onClick={() => download(`/common/documents/${documentId}/content`).catch((error: Error) => message.error(error.message))}>
      {label}
    </Button>
  );
}

/** End-of-day batch: daily issuance and receipt totals, EOD report and FIN posting file. */
export default function EodPage() {
  const { message } = App.useApp();
  const [running, setRunning] = useState(false);
  const runs = usePagedQuery<EodRun>('/backoffice/eod');
  // A failed batch is still recorded as a run, so the outcome is read from the result.
  const run = useApiMutation((businessDate: string) => api.post<EodRun>('/backoffice/eod', { businessDate }), {
    invalidate: ['/backoffice/eod', '/backoffice/integration'],
    onSuccess: (result) => {
      setRunning(false);
      if (result.status === 'FAILED') message.error(`End of day failed: ${result.errorMessage ?? 'see the run details'}`);
      else message.success(`End of day completed for ${formatDate(result.businessDate)}`);
    },
  });

  return (
    <>
      <PageHeader
        title="End of day"
        subtitle="Daily close: policies issued, receipts, EOD report and the FIN interface file"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'End of day' }]}
        extra={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setRunning(true)}>
            Run end of day
          </Button>
        }
      />
      <Card className="content-card">
        <Table<EodRun>
          size="middle"
          rowKey="id"
          loading={runs.isFetching}
          dataSource={runs.items}
          pagination={runs.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'End of day has not been run yet' }}
          columns={[
            { title: 'Business date', dataIndex: 'businessDate', render: formatDate },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (status: string, row) => (
                <Tooltip title={row.errorMessage}>
                  <span>
                    <StatusTag status={status} />
                  </span>
                </Tooltip>
              ),
            },
            { title: 'Policies issued', dataIndex: 'policiesIssued', align: 'right', render: formatNumber },
            { title: 'Contribution', dataIndex: 'totalContribution', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Receipts issued', dataIndex: 'receiptsIssued', align: 'right', render: formatNumber },
            { title: 'Receipts total', dataIndex: 'totalReceipts', align: 'right', render: (value: string) => <Money value={value} /> },
            { title: 'Started', dataIndex: 'startedAt', render: formatDateTime },
            { title: 'Finished', dataIndex: 'finishedAt', render: formatDateTime },
            { title: 'Run by', dataIndex: 'triggeredBy' },
            {
              title: 'Files',
              key: 'files',
              render: (_: unknown, row) => (
                <Flex gap={6}>
                  <FileButton documentId={row.reportDocumentId} label="EOD report" />
                  <FileButton documentId={row.finFileDocumentId} label="FIN file" />
                </Flex>
              ),
            },
          ]}
        />
      </Card>
      {running && (
        <BusinessDateModal
          title="Run end of day"
          okText="Run"
          description={
            <Typography.Text type="secondary">
              Totals the policies issued and receipts of the day, produces the EOD report and queues the FIN posting. Running a date again replaces its report and FIN file.
            </Typography.Text>
          }
          pending={run.isPending}
          error={run.error}
          onSubmit={(businessDate) => run.mutate(businessDate)}
          onClose={() => setRunning(false)}
        />
      )}
    </>
  );
}
