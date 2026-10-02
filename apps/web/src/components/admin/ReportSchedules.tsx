import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, Flex, Form, Input, Modal, Row, Select, Switch, Table } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ExportFormat, ReportFrequency, ReportSchedule, SchedulePeriod } from '../../api/admin-types';
import type { ReportDefinition } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { QueryState } from '../QueryState';
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

function CreateScheduleModal({ reports, onClose }: { reports: ReportDefinition[]; onClose(): void }) {
  const [form] = Form.useForm<ScheduleValues>();
  const create = useApiMutation((values: ScheduleValues) => api.post<ReportSchedule>(SCHEDULES_PATH, values), {
    success: 'Report schedule created',
    invalidate: [SCHEDULES_PATH],
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      title="Schedule a report"
      okText="Create schedule"
      okButtonProps={{ loading: create.isPending }}
      onCancel={onClose}
      onOk={() => form.validateFields().then((values) => create.mutate({ ...values, name: values.name.trim() }))}
      destroyOnHidden
      width={600}
    >
      <ErrorAlert error={create.error} className="mb-16" />
      <Form form={form} layout="vertical" requiredMark="optional" initialValues={{ frequency: 'DAILY', format: 'XLSX', period: 'PREVIOUS_DAY' }}>
        <Form.Item name="reportCode" label="Report" rules={[{ required: true, message: 'Choose a report' }]}>
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            options={reports.map((report) => ({ value: report.code, label: report.name }))}
            onChange={(code: string) => {
              if (!form.getFieldValue('name')) form.setFieldValue('name', reports.find((report) => report.code === code)?.name);
            }}
          />
        </Form.Item>
        <Form.Item name="name" label="Schedule name" rules={[{ required: true, whitespace: true, message: 'Enter a name' }, { min: 3, max: 150 }]}>
          <Input />
        </Form.Item>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item name="frequency" label="Frequency" rules={[{ required: true }]}>
              <Select options={enumOptions(FREQUENCIES, humanise)} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="period" label="Data period" rules={[{ required: true }]}>
              <Select options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="format" label="Format" rules={[{ required: true }]}>
              <Select options={EXPORT_FORMATS} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item
          name="recipients"
          label="Recipients"
          extra="Type an email address and press Enter"
          rules={[
            { required: true, type: 'array', min: 1, message: 'Add at least one recipient' },
            { type: 'array', max: MAX_RECIPIENTS, message: `At most ${MAX_RECIPIENTS} recipients` },
            {
              validator: (_, value: string[] = []) => {
                const invalid = value.filter((email) => !EMAIL.test(email));
                return invalid.length === 0 ? Promise.resolve() : Promise.reject(new Error(`Not a valid email: ${invalid.join(', ')}`));
              },
            },
          ]}
        >
          <Select mode="tags" tokenSeparators={[',', ';', ' ']} open={false} suffixIcon={null} aria-label="Recipients" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** BO-25: reports produced and emailed automatically on a daily, weekly or monthly schedule. */
export function ReportSchedules({ reports }: { reports: ReportDefinition[] }) {
  const [creating, setCreating] = useState(false);
  const schedules = useApiQuery<ReportSchedule[]>(SCHEDULES_PATH);
  const setActive = useApiMutation(({ id, active }: { id: string; active: boolean }) => api.put<ReportSchedule>(`${SCHEDULES_PATH}/${id}/active`, { active }), {
    success: 'Schedule updated',
    invalidate: [SCHEDULES_PATH],
  });
  const reportName = (code: string) => reports.find((report) => report.code === code)?.name ?? code;

  return (
    <>
      <Flex justify="flex-end" className="mb-16">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          Schedule a report
        </Button>
      </Flex>
      <ErrorAlert error={setActive.error} className="mb-16" />
      <QueryState query={schedules}>
        {(items) => (
          <Table<ReportSchedule>
            size="middle"
            rowKey="id"
            pagination={false}
            dataSource={items}
            scroll={{ x: 'max-content' }}
            locale={{ emptyText: 'No reports are scheduled' }}
            columns={[
              { title: 'Name', dataIndex: 'name' },
              { title: 'Report', dataIndex: 'reportCode', render: reportName },
              { title: 'Frequency', dataIndex: 'frequency', render: humanise },
              { title: 'Period', key: 'period', render: (_: unknown, schedule) => (schedule.filters.period ? PERIOD_LABELS[schedule.filters.period] : '–') },
              { title: 'Format', dataIndex: 'format', render: (format: ExportFormat) => EXPORT_FORMATS.find((option) => option.value === format)?.label },
              { title: 'Recipients', dataIndex: 'recipients', width: 260, ellipsis: true, render: (recipients: string[]) => recipients.join(', ') },
              { title: 'Last run', dataIndex: 'lastRunAt', render: formatDateTime },
              { title: 'Next run', dataIndex: 'nextRunAt', render: (value: string, schedule) => (schedule.active ? formatDateTime(value) : 'Paused') },
              {
                title: 'Active',
                dataIndex: 'active',
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
            ]}
          />
        )}
      </QueryState>
      {creating && <CreateScheduleModal reports={reports} onClose={() => setCreating(false)} />}
    </>
  );
}
