import { Alert, DatePicker, Form, Input, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { ApprovalRequest, PolicyDetail } from '../../api/types';
import { FormModal } from './FormModal';
import { ISO_DATE } from './options';
import { useCodes } from './useCodes';

interface Values {
  reasonCode: string;
  remarks: string;
  effectiveDate: Dayjs;
}

/** AP-28: request cancellation of an active policy; takes effect after IIFT approval. */
export function CancellationModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const [form] = Form.useForm<Values>();
  const reasons = useCodes('CANCELLATION_REASON');
  const request = useApiMutation(
    (values: Values) =>
      api.post<ApprovalRequest>(`/portal/policies/${policy.id}/cancellations`, {
        reasonCode: values.reasonCode,
        remarks: values.remarks.trim(),
        effectiveDate: values.effectiveDate.format(ISO_DATE),
      }),
    {
      success: 'Cancellation request submitted for approval',
      invalidate: ['/portal/policies', '/portal/requests'],
      onSuccess: onClose,
    },
  );
  const coverStart = policy.startDate ? dayjs(policy.startDate) : null;

  return (
    <FormModal<Values>
      title={`Cancel ${policy.policyNo}`}
      okText="Submit cancellation request"
      danger
      form={form}
      initialValues={{ effectiveDate: dayjs() }}
      onSubmit={(values) => request.mutate(values)}
      onClose={onClose}
      pending={request.isPending}
      error={request.error}
    >
      <Alert
        className="mb-16"
        type="warning"
        showIcon
        title="The policy stays in force until IIFT approves the cancellation."
      />
      <Form.Item
        name="reasonCode"
        label="Reason"
        rules={[{ required: true, message: 'Choose the reason' }]}
      >
        <Select options={reasons.options} loading={reasons.loading} />
      </Form.Item>
      <Form.Item
        name="effectiveDate"
        label="Effective date"
        rules={[{ required: true, message: 'Choose the effective date' }]}
      >
        <DatePicker
          className="full-width"
          format="DD MMM YYYY"
          disabledDate={(date) => (coverStart ? date.isBefore(coverStart, 'day') : false)}
        />
      </Form.Item>
      <Form.Item
        name="remarks"
        label="Remarks"
        rules={[
          { required: true, whitespace: true, message: 'Enter the remarks' },
          { min: 5, max: 1000, message: 'Between 5 and 1,000 characters' },
        ]}
      >
        <Input.TextArea rows={3} maxLength={1000} showCount />
      </Form.Item>
    </FormModal>
  );
}
