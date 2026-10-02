import { Button, Form, Input, Modal, Radio, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { AmlScreening } from '../../api/types';
import { humanise } from '../../utils/format';
import { DataTable, dateTimeColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { ErrorAlert } from '../ErrorAlert';
import { FieldGrid } from '../FieldGrid';
import { StatusTag } from '../StatusTag';
import { TableToolbar } from '../TableCard';
import { AmlMatchesTable, renderScreeningMatches } from './AmlMatchesTable';
import { recordPath } from './links';
import { enumOptions } from './useCodes';

type CaseStatus = AmlScreening['status'];
const STATUSES: CaseStatus[] = ['PENDING_REVIEW', 'CLEARED', 'CONFIRMED_MATCH', 'AUTO_CLEARED'];

interface ReviewValues {
  decision: 'CLEARED' | 'CONFIRMED_MATCH';
  remarks: string;
}

function ReviewModal({ screening, onClose }: { screening: AmlScreening; onClose(): void }) {
  const [form] = Form.useForm<ReviewValues>();
  const review = useApiMutation(
    (values: ReviewValues) =>
      api.post<AmlScreening>(`/backoffice/aml/cases/${screening.id}/review`, {
        ...values,
        remarks: values.remarks.trim(),
      }),
    {
      success: 'Review recorded',
      invalidate: ['/backoffice'],
      onSuccess: onClose,
    },
  );

  return (
    <Modal
      open
      title={`Review screening – ${screening.subjectName}`}
      okText="Record decision"
      okButtonProps={{ loading: review.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={720}
    >
      <ErrorAlert error={review.error} className="mb-16" />
      <FieldGrid
        columns={4}
        className="mb-16"
        items={[
          { key: 'subject', label: 'Subject', value: screening.subjectName },
          { key: 'type', label: 'Type', value: humanise(screening.subjectType) },
          { key: 'provider', label: 'Provider', value: humanise(screening.provider) },
          { key: 'score', label: 'Highest score', value: screening.score },
        ]}
      />
      <div className="mb-16">
        <AmlMatchesTable matches={screening.matches} />
      </div>
      <Form
        form={form}
        onFinish={(values) => review.mutate(values)}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item
          name="decision"
          label="Decision"
          rules={[{ required: true, message: 'Choose a decision' }]}
        >
          <Radio.Group
            options={[
              { value: 'CLEARED', label: 'Cleared – not the listed person' },
              { value: 'CONFIRMED_MATCH', label: 'Confirmed match – subject rejected' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="remarks"
          label="Remarks"
          tooltip="Evidence checked and basis for the decision"
          rules={[
            { required: true, whitespace: true, message: 'Enter the review remarks' },
            { min: 3, max: 1000 },
          ]}
        >
          <Input.TextArea rows={4} maxLength={1000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** BO-13..15: screening results, defaulting to those awaiting a compliance decision. */
export function AmlCases() {
  const [status, setStatus] = useState<CaseStatus>('PENDING_REVIEW');
  const [reviewing, setReviewing] = useState<AmlScreening>();
  const cases = usePagedQuery<AmlScreening>('/backoffice/aml/cases', { status });

  const pendingOnly = status === 'PENDING_REVIEW';
  const columns: ColumnsType<AmlScreening> = [
    dateTimeColumn('Screened', 'createdAt', 160),
    {
      title: 'Subject',
      dataIndex: 'subjectName',
      ellipsis: true,
      render: (name: string, row) => {
        const path = recordPath('BACKOFFICE', row.subjectType, row.subjectId);
        return path ? <Link to={path}>{name}</Link> : name;
      },
    },
    { title: 'Type', dataIndex: 'subjectType', width: 95, render: humanise },
    { title: 'Provider', dataIndex: 'provider', width: 95, render: humanise },
    { title: 'Score', dataIndex: 'score', width: 70, align: 'right', className: 'money' },
    {
      title: 'Matches',
      key: 'matches',
      width: 80,
      align: 'right',
      className: 'money',
      render: (_: unknown, row) => row.matches.length,
    },
    {
      title: 'Outcome',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => <StatusTag status={value} />,
    },
    ...(pendingOnly
      ? [
          {
            key: 'actions',
            width: 90,
            align: 'right' as const,
            render: (_: unknown, row: AmlScreening) => (
              <Button size="small" type="primary" onClick={() => setReviewing(row)}>
                Review
              </Button>
            ),
          },
        ]
      : [
          dateTimeColumn<AmlScreening>('Reviewed', 'reviewedAt', 150),
          textColumn<AmlScreening>('Remarks', 'reviewRemarks', 150),
        ]),
  ];

  return (
    <>
      <TableToolbar
        filters={
          <Select
            aria-label="Case status"
            className="filter-select filter-select--wide"
            value={status}
            options={enumOptions(STATUSES, humanise)}
            onChange={(value: CaseStatus) => {
              setStatus(value);
              cases.resetPage();
            }}
          />
        }
      />
      <DataTable<AmlScreening>
        rowKey="id"
        loading={cases.isFetching}
        dataSource={cases.items}
        pagination={cases.pagination}
        columns={columns}
        expandable={{
          rowExpandable: (row) => row.matches.length > 0,
          expandedRowRender: renderScreeningMatches,
        }}
        locale={{
          emptyText: (
            <EmptyState
              label={status === 'PENDING_REVIEW' ? 'No screenings to review' : 'No screenings'}
            />
          ),
        }}
      />
      {reviewing && <ReviewModal screening={reviewing} onClose={() => setReviewing(undefined)} />}
    </>
  );
}
