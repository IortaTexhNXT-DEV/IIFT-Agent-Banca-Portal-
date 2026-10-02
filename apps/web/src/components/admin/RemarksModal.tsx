import { Form, Input, Modal } from 'antd';
import type { ReactNode } from 'react';
import { ErrorAlert } from '../ErrorAlert';

interface Props {
  title: string;
  okText: string;
  label?: string;
  /** Remarks are mandatory for rejections and other irreversible decisions. */
  required?: boolean;
  danger?: boolean;
  maxLength?: number;
  description?: ReactNode;
  pending: boolean;
  error: unknown;
  onSubmit(remarks: string): void;
  onClose(): void;
}

const MIN_LENGTH = 3;

/** Confirms a decision and captures the remarks or reason that go with it. */
export function RemarksModal({ title, okText, label = 'Remarks', required = false, danger = false, maxLength = 1000, description, pending, error, onSubmit, onClose }: Props) {
  const [form] = Form.useForm<{ remarks?: string }>();
  return (
    <Modal
      open
      title={title}
      okText={okText}
      okButtonProps={{ danger, loading: pending }}
      onCancel={onClose}
      onOk={() => form.validateFields().then((values) => onSubmit(values.remarks?.trim() ?? ''))}
      destroyOnHidden
    >
      {description && <div className="mb-16">{description}</div>}
      <ErrorAlert error={error} className="mb-16" />
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="remarks"
          label={label}
          rules={
            required
              ? [
                  { required: true, whitespace: true, message: `Enter the ${label.toLowerCase()}` },
                  { min: MIN_LENGTH, message: `At least ${MIN_LENGTH} characters` },
                ]
              : []
          }
        >
          <Input.TextArea rows={4} maxLength={maxLength} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
