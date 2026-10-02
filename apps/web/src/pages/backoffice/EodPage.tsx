import {
  CalendarOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  FileProtectOutlined,
  PlayCircleOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { App, Button, Tooltip } from 'antd';
import { useState } from 'react';
import { api, download } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { EodRun } from '../../api/admin-types';
import { BusinessDateModal } from '../../components/admin/BusinessDateModal';
import {
  DataTable,
  dateColumn,
  dateTimeColumn,
  moneyColumn,
  textColumn,
} from '../../components/DataTable';
import { KpiGrid, KpiTile, type KpiTone } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { TableCard } from '../../components/TableCard';
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  humanise,
} from '../../utils/format';
import '../../styles/admin.css';

function FileLink({ documentId, label }: { documentId: string | null; label: string }) {
  const { message } = App.useApp();
  if (!documentId) return null;
  return (
    <Button
      size="small"
      type="link"
      icon={<DownloadOutlined />}
      onClick={() =>
        download(`/common/documents/${documentId}/content`).catch((error: Error) =>
          message.error(error.message),
        )
      }
    >
      {label}
    </Button>
  );
}

const STATUS_TONE: Record<EodRun['status'], KpiTone> = {
  COMPLETED: 'default',
  RUNNING: 'accent',
  FAILED: 'danger',
};

/** Latest business date at a glance. */
function LatestRun({ run }: { run: EodRun | undefined }) {
  return (
    <KpiGrid columns={5}>
      <KpiTile
        label="Business date"
        icon={<CalendarOutlined />}
        value={run ? formatDate(run.businessDate) : '–'}
        sub={run ? `Run by ${run.triggeredBy}` : 'Not run yet'}
      />
      <KpiTile
        label="Policies issued"
        icon={<FileProtectOutlined />}
        tone="accent"
        value={run ? formatNumber(run.policiesIssued) : '–'}
      />
      <KpiTile
        label="Contribution"
        icon={<WalletOutlined />}
        value={run ? formatMoney(run.totalContribution) : '–'}
      />
      <KpiTile
        label="Receipts"
        icon={<WalletOutlined />}
        value={run ? formatNumber(run.receiptsIssued) : '–'}
        sub={run ? `${formatMoney(run.totalReceipts)} received` : undefined}
      />
      <KpiTile
        label="Status"
        icon={<CheckCircleOutlined />}
        tone={run ? STATUS_TONE[run.status] : 'default'}
        value={run ? humanise(run.status) : '–'}
        sub={run?.finishedAt ? `Completed ${formatDateTime(run.finishedAt)}` : undefined}
      />
    </KpiGrid>
  );
}

/** End-of-day batch: daily issuance and receipt totals, EOD report and FIN posting file. */
export default function EodPage() {
  const { message } = App.useApp();
  const [running, setRunning] = useState(false);
  const runs = usePagedQuery<EodRun>('/backoffice/eod');
  // A failed batch is still recorded as a run, so the outcome is read from the result.
  const run = useApiMutation(
    (businessDate: string) => api.post<EodRun>('/backoffice/eod', { businessDate }),
    {
      invalidate: ['/backoffice/eod', '/backoffice/integration'],
      onSuccess: (result) => {
        setRunning(false);
        if (result.status === 'FAILED')
          message.error(`End of day failed: ${result.errorMessage ?? 'see the run details'}`);
        else message.success(`End of day completed for ${formatDate(result.businessDate)}`);
      },
    },
  );

  return (
    <>
      <PageHeader
        title="End of day"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'End of day' }]}
        extra={
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setRunning(true)}>
            Run end of day
          </Button>
        }
      />
      <LatestRun run={runs.items[0]} />
      <TableCard title="Runs">
        <DataTable<EodRun>
          rowKey="id"
          scroll={{}}
          loading={runs.isFetching}
          dataSource={runs.items}
          pagination={runs.pagination}
          locale={{ emptyText: 'No runs' }}
          columns={[
            dateColumn('Business date', 'businessDate', 130),
            {
              title: 'Status',
              dataIndex: 'status',
              width: 110,
              render: (status: string, row) => (
                <Tooltip title={row.errorMessage}>
                  <span>
                    <StatusTag status={status} />
                  </span>
                </Tooltip>
              ),
            },
            {
              title: 'Policies',
              dataIndex: 'policiesIssued',
              width: 80,
              align: 'right',
              render: formatNumber,
            },
            moneyColumn('Contribution', 'totalContribution', 120),
            {
              title: 'Receipts',
              dataIndex: 'receiptsIssued',
              width: 80,
              align: 'right',
              render: formatNumber,
            },
            moneyColumn('Receipts total', 'totalReceipts', 130),
            dateTimeColumn('Completed', 'finishedAt', 160),
            textColumn('Run by', 'triggeredBy'),
            {
              title: 'Files',
              key: 'files',
              width: 200,
              render: (_: unknown, row) => (
                <span className="file-links">
                  <FileLink documentId={row.reportDocumentId} label="EOD report" />
                  <FileLink documentId={row.finFileDocumentId} label="FIN file" />
                </span>
              ),
            },
          ]}
        />
      </TableCard>
      {running && (
        <BusinessDateModal
          title="Run end of day"
          okText="Run"
          description="Running a date again replaces its report and FIN file"
          pending={run.isPending}
          error={run.error}
          onSubmit={(businessDate) => run.mutate(businessDate)}
          onClose={() => setRunning(false)}
        />
      )}
    </>
  );
}
