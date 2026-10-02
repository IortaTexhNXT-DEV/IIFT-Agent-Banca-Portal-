import { Button, Card, Form, Input, Modal, Radio, Select, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { AmlScreening } from '../../api/types';
import { formatDateTime, humanise } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { FilterBar } from '../FilterBar';
import { StatusTag } from '../StatusTag';
import { AmlMatchesTable, renderScreeningMatches } from './AmlMatchesTable';
import { CellText } from './CellText';
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
              { value: 'CONFIRMED_MATCH', label: 'Confirmed match – the subject is rejected' },
            ]}
          />
        </Form.Item>
        <Form.Item
          name="remarks"
          label="Remarks"
          extra="Evidence checked and basis for the decision"
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

  return (
    <>
      <FilterBar>
        <Select
          aria-label="Case status"
          style={{ width: 200 }}
          value={status}
          options={enumOptions(STATUSES, humanise)}
          onChange={(value: CaseStatus) => {
            setStatus(value);
            cases.resetPage();
          }}
        />
      </FilterBar>
      <Card className="content-card">
        <Table<AmlScreening>
          size="middle"
          rowKey="id"
          loading={cases.isFetching}
          dataSource={cases.items}
          pagination={cases.pagination}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText:
              status === 'PENDING_REVIEW'
                ? 'No screenings are waiting for review'
                : 'No screenings with this status',
          }}
          expandable={{
            rowExpandable: (row) => row.matches.length > 0,
            expandedRowRender: renderScreeningMatches,
          }}
          columns={[
            { title: 'Screened', dataIndex: 'createdAt', render: formatDateTime },
            {
              title: 'Subject',
              dataIndex: 'subjectName',
              render: (name: string, row) => {
                const path = recordPath('BACKOFFICE', row.subjectType, row.subjectId);
                return path ? <Link to={path}>{name}</Link> : name;
              },
            },
            { title: 'Type', dataIndex: 'subjectType', render: humanise },
            { title: 'Provider', dataIndex: 'provider', render: humanise },
            { title: 'Highest score', dataIndex: 'score', align: 'right' },
            {
              title: 'Matches',
              key: 'matches',
              align: 'right',
              render: (_: unknown, row) => row.matches.length,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (value: string) => <StatusTag status={value} />,
            },
            { title: 'Reviewed', dataIndex: 'reviewedAt', render: formatDateTime },
            {
              title: 'Remarks',
              dataIndex: 'reviewRemarks',
              render: (remarks: string | null) => <CellText text={remarks} width={220} />,
            },
            {
              key: 'actions',
              render: (_: unknown, row) =>
                row.status === 'PENDING_REVIEW' && (
                  <Button size="small" type="primary" onClick={() => setReviewing(row)}>
                    Review
                  </Button>
                ),
            },
          ]}
        />
      </Card>
      {reviewing && <ReviewModal screening={reviewing} onClose={() => setReviewing(undefined)} />}
    </>
  );
}
