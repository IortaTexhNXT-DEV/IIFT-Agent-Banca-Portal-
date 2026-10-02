import { DownloadOutlined, InfoCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Button, Card, Col, Dropdown, Form, Menu, Row, Tabs, Tooltip } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { download } from '../../api/client';
import { useApiQuery } from '../../api/hooks';
import type { ExportFormat } from '../../api/admin-types';
import type { ReportDefinition, ReportPreview } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { basePathFor } from '../../components/admin/links';
import {
  type ReportFilterValues,
  ReportFilters,
  type ReportQuery,
  toReportQuery,
} from '../../components/admin/ReportFilters';
import { ReportPreviewTable } from '../../components/admin/ReportPreviewTable';
import { EXPORT_FORMATS, ReportSchedules } from '../../components/admin/ReportSchedules';
import { ActionBar } from '../../components/ActionBar';
import { EmptyState } from '../../components/EmptyState';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { TableCard } from '../../components/TableCard';
import { formatNumber } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/admin.css';

type Tab = 'run' | 'schedules';

function PreviewCaption({ preview }: { preview: ReportPreview }) {
  const rows = formatNumber(preview.rows.length);
  return (
    <span className="muted">
      {preview.truncated ? `First ${rows} rows – export for the full result` : `${rows} rows`}
    </span>
  );
}

function ReportRunner({ report, apiBase }: { report: ReportDefinition; apiBase: string }) {
  const [form] = Form.useForm<ReportFilterValues>();
  const [applied, setApplied] = useState<ReportQuery>();
  const [exporting, setExporting] = useState<ExportFormat>();
  const [exportError, setExportError] = useState<unknown>();
  const preview = useApiQuery<ReportPreview>(applied ? `${apiBase}/${report.code}` : null, applied);

  const exportAs = async (format: ExportFormat) => {
    setExporting(format);
    setExportError(undefined);
    try {
      await download(`${apiBase}/${report.code}/export`, {
        ...toReportQuery(form.getFieldsValue()),
        format,
      });
    } catch (error) {
      setExportError(error);
    } finally {
      setExporting(undefined);
    }
  };

  return (
    <>
      <Card
        className="content-card"
        title={
          <span className="report-title">
            {report.name}
            {report.description && (
              <Tooltip title={report.description}>
                <InfoCircleOutlined className="report-title__info" />
              </Tooltip>
            )}
          </span>
        }
      >
        <ErrorAlert error={exportError} className="mb-16" />
        <ReportFilters report={report} form={form} />
        <ActionBar
          start={
            <Dropdown
              menu={{
                items: EXPORT_FORMATS.map(({ value, label }) => ({ key: value, label })),
                onClick: ({ key }) => void exportAs(key as ExportFormat),
              }}
              disabled={exporting !== undefined}
            >
              <Button icon={<DownloadOutlined />} loading={exporting !== undefined}>
                Export
              </Button>
            </Dropdown>
          }
        >
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={preview.isFetching}
            onClick={() => setApplied(toReportQuery(form.getFieldsValue()))}
          >
            Run report
          </Button>
        </ActionBar>
      </Card>
      <TableCard title="Preview" extra={preview.data && <PreviewCaption preview={preview.data} />}>
        {applied ? (
          <div className={preview.data ? undefined : 'table-inset'}>
            <QueryState query={preview}>
              {(data) => <ReportPreviewTable preview={data} />}
            </QueryState>
          </div>
        ) : (
          <EmptyState icon={<PlayCircleOutlined />} label="Run the report to preview it" />
        )}
      </TableCard>
    </>
  );
}

function ReportCatalogue({ reports, apiBase }: { reports: ReportDefinition[]; apiBase: string }) {
  const [selected, setSelected] = useState(reports[0]?.code);
  const report = reports.find((item) => item.code === selected);
  if (!report) {
    return (
      <Card className="content-card">
        <EmptyState label="No reports available for your role" />
      </Card>
    );
  }

  return (
    <Row gutter={16}>
      <Col xs={24} lg={7} xl={6}>
        <Card title="Reports" className="content-card content-card--flush">
          <Menu
            mode="inline"
            selectedKeys={[report.code]}
            items={reports.map((item) => ({ key: item.code, label: item.name }))}
            onClick={({ key }) => setSelected(key)}
            className="report-menu"
          />
        </Card>
      </Col>
      <Col xs={24} lg={17} xl={18}>
        <ReportRunner key={report.code} report={report} apiBase={apiBase} />
      </Col>
    </Row>
  );
}

/** AP-58, BO-22..25, COM-08: standard reports with filters, preview, export and schedules. */
export default function ReportsPage() {
  const { user, can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const audience = user?.audience ?? 'PORTAL';
  const apiBase = `${basePathFor(audience)}/reports`;
  const catalogue = useApiQuery<ReportDefinition[]>(apiBase);
  const canSchedule = audience === 'BACKOFFICE' && can(P.boReportsSchedule);
  const tab: Tab = canSchedule && searchParams.get('tab') === 'schedules' ? 'schedules' : 'run';

  return (
    <>
      <PageHeader
        title="Reports"
        breadcrumb={[{ title: 'Home', to: basePathFor(audience) }, { title: 'Reports' }]}
      />
      <QueryState query={catalogue}>
        {(reports) =>
          canSchedule ? (
            <Tabs
              className="page-tabs"
              activeKey={tab}
              onChange={(key) =>
                setSearchParams(key === 'run' ? {} : { tab: key }, { replace: true })
              }
              items={[
                {
                  key: 'run',
                  label: 'Run a report',
                  children: <ReportCatalogue reports={reports} apiBase={apiBase} />,
                },
                {
                  key: 'schedules',
                  label: 'Scheduled reports',
                  children: <ReportSchedules reports={reports} />,
                },
              ]}
            />
          ) : (
            <ReportCatalogue reports={reports} apiBase={apiBase} />
          )
        }
      </QueryState>
    </>
  );
}
