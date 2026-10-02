import { DatePicker, Form, Modal } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import type { ReactNode } from 'react';
import { ErrorAlert } from '../ErrorAlert';
import '../../styles/admin.css';

interface Props {
  title: string;
  okText: string;
  /** One line shown under the date, e.g. "Replaces the report and FIN file of the date". */
  description?: ReactNode;
  pending: boolean;
  error: unknown;
  /** Called with the chosen business date as YYYY-MM-DD. */
  onSubmit(businessDate: string): void;
  onClose(): void;
}

/** Asks for the business date of a batch run (end of day, reconciliation); future dates are not allowed. */
export function BusinessDateModal({
  title,
  okText,
  description,
  pending,
  error,
  onSubmit,
  onClose,
}: Props) {
  const [form] = Form.useForm<{ businessDate: Dayjs }>();
  return (
    <Modal
      open
      title={title}
      okText={okText}
      okButtonProps={{ loading: pending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={400}
    >
      <ErrorAlert error={error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => onSubmit(values.businessDate.format('YYYY-MM-DD'))}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ businessDate: dayjs() }}
      >
        <Form.Item
          name="businessDate"
          label="Business date"
          extra={description}
          rules={[{ required: true, message: 'Choose the business date' }]}
        >
          <DatePicker
            format="DD MMM YYYY"
            className="w-full"
            disabledDate={(date) => date.isAfter(dayjs(), 'day')}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
