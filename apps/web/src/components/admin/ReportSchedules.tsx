import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, Switch } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type {
  ExportFormat,
  ReportFrequency,
  ReportSchedule,
  SchedulePeriod,
} from '../../api/admin-types';
import type { ReportDefinition } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { DataTable, dateTimeColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { TableCard } from '../TableCard';
import { enumOptions } from './useCodes';

const FREQUENCIES: ReportFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
export const EXPORT_FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'XLSX', label: 'Excel' },
  { value: 'CSV', label: 'CSV' },
  { value: 'PDF', label: 'PDF' },
];
const PERIOD_LABELS: Record<SchedulePeriod, string> = {
  PREVIOUS_DAY: 'Previous day',
  PREVIOUS_7_DAYS: 'Previous 7 days',
  PREVIOUS_MONTH: 'Previous month',
  MONTH_TO_DATE: 'Month to date',
};
const SCHEDULES_PATH = '/backoffice/reports/schedules';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_RECIPIENTS = 20;

interface ScheduleValues {
  reportCode: string;
  name: string;
  frequency: ReportFrequency;
  format: ExportFormat;
  period: SchedulePeriod;
  recipients: string[];
}

function CreateScheduleModal({
  reports,
  onClose,
}: {
  reports: ReportDefinition[];
  onClose(): void;
}) {
  const [form] = Form.useForm<ScheduleValues>();
  const create = useApiMutation(
    (values: ScheduleValues) => api.post<ReportSchedule>(SCHEDULES_PATH, values),
    {
      success: 'Report schedule created',
      invalidate: [SCHEDULES_PATH],
      onSuccess: onClose,
    },
  );

  return (
    <Modal
      open
      title="Schedule a report"
      okText="Create schedule"
      okButtonProps={{ loading: create.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={640}
    >
      <ErrorAlert error={create.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => create.mutate({ ...values, name: values.name.trim() })}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ frequency: 'DAILY', format: 'XLSX', period: 'PREVIOUS_DAY' }}
      >
        <FormSection title="Report">
          <Form.Item
            name="reportCode"
            label="Report"
            rules={[{ required: true, message: 'Choose a report' }]}
          >
            <Select
              showSearch={{ optionFilterProp: 'label' }}
              options={reports.map((report) => ({ value: report.code, label: report.name }))}
              onChange={(code: string) => {
                if (!form.getFieldValue('name'))
                  form.setFieldValue('name', reports.find((report) => report.code === code)?.name);
              }}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Schedule name"
            rules={[
              { required: true, whitespace: true, message: 'Enter a name' },
              { min: 3, max: 150 },
            ]}
          >
            <Input />
          </Form.Item>
        </FormSection>
        <FormSection title="Delivery" columns={3}>
          <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]}>
            <Select options={enumOptions(FREQUENCIES, humanise)} />
          </Form.Item>
          <Form.Item name="period" label="Data period" rules={[{ required: true }]}>
            <Select
              options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </Form.Item>
          <Form.Item name="format" label="Format" rules={[{ required: true }]}>
            <Select options={EXPORT_FORMATS} />
          </Form.Item>
          <Form.Item
            name="recipients"
            label="Recipients"
            className="field--full"
            tooltip="Type an email address and press Enter"
            rules={[
              { required: true, type: 'array', min: 1, message: 'Add at least one recipient' },
              {
                type: 'array',
                max: MAX_RECIPIENTS,
                message: `At most ${MAX_RECIPIENTS} recipients`,
              },
              {
                validator: (_, value: string[] = []) => {
                  const invalid = value.filter((email) => !EMAIL.test(email));
                  return invalid.length === 0
                    ? Promise.resolve()
                    : Promise.reject(new Error(`Not a valid email: ${invalid.join(', ')}`));
                },
              },
            ]}
          >
            <Select
              mode="tags"
              tokenSeparators={[',', ';', ' ']}
              open={false}
              suffixIcon={null}
              aria-label="Recipients"
            />
          </Form.Item>
        </FormSection>
      </Form>
    </Modal>
  );
}

/** BO-25: reports produced and emailed automatically on a daily, weekly or monthly schedule. */
export function ReportSchedules({ reports }: { reports: ReportDefinition[] }) {
  const [creating, setCreating] = useState(false);
  const schedules = useApiQuery<ReportSchedule[]>(SCHEDULES_PATH);
  const setActive = useApiMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      api.put<ReportSchedule>(`${SCHEDULES_PATH}/${id}/active`, { active }),
    {
      success: 'Schedule updated',
      invalidate: [SCHEDULES_PATH],
    },
  );
  const reportName = (code: string) => reports.find((report) => report.code === code)?.name ?? code;

  const columns: ColumnsType<ReportSchedule> = [
    textColumn('Name', 'name', 160),
    {
      title: 'Report',
      dataIndex: 'reportCode',
      width: 180,
      ellipsis: true,
      render: reportName,
    },
    {
      title: 'Schedule',
      key: 'schedule',
      width: 180,
      render: (_: unknown, schedule) =>
        [
          humanise(schedule.frequency),
          schedule.filters.period && PERIOD_LABELS[schedule.filters.period].toLowerCase(),
        ]
          .filter(Boolean)
          .join(' · '),
    },
    {
      title: 'Format',
      dataIndex: 'format',
      width: 80,
      render: (format: ExportFormat) =>
        EXPORT_FORMATS.find((option) => option.value === format)?.label,
    },
    {
      title: 'Recipients',
      dataIndex: 'recipients',
      ellipsis: true,
      render: (recipients: string[]) => recipients.join(', '),
    },
    dateTimeColumn('Last run', 'lastRunAt', 140),
    {
      title: 'Next run',
      dataIndex: 'nextRunAt',
      width: 140,
      render: (value: string, schedule) => (schedule.active ? formatDateTime(value) : 'Paused'),
    },
    {
      title: 'Active',
      dataIndex: 'active',
      width: 90,
      align: 'center',
      render: (active: boolean, schedule) => (
        <Switch
          size="small"
          checked={active}
          aria-label={`${active ? 'Pause' : 'Resume'} ${schedule.name}`}
          loading={setActive.isPending && setActive.variables?.id === schedule.id}
          onChange={(checked) => setActive.mutate({ id: schedule.id, active: checked })}
        />
      ),
    },
  ];

  return (
    <>
      <TableCard
        title="Scheduled reports"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
            Schedule a report
          </Button>
        }
      >
        {setActive.error && (
          <div className="table-inset">
            <ErrorAlert error={setActive.error} />
          </div>
        )}
        <DataTable<ReportSchedule>
          rowKey="id"
          loading={schedules.isLoading}
          pagination={false}
          dataSource={schedules.data ?? []}
          columns={columns}
          locale={{
            emptyText: schedules.error ? (
              <ErrorAlert error={schedules.error} />
            ) : (
              <EmptyState label="No scheduled reports yet" />
            ),
          }}
        />
      </TableCard>
      {creating && <CreateScheduleModal reports={reports} onClose={() => setCreating(false)} />}
    </>
  );
}
