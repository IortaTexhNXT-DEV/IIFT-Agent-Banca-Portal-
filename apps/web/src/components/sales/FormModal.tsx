import { Form, type FormInstance, Modal } from 'antd';
import type { ReactNode } from 'react';
import { ErrorAlert } from '../ErrorAlert';

interface Props<T> {
  title: string;
  okText: string;
  form: FormInstance<T>;
  onSubmit(values: T): void;
  onClose(): void;
  pending: boolean;
  error: unknown;
  children: ReactNode;
  initialValues?: Partial<T>;
  width?: number;
  danger?: boolean;
}

/** Modal around a vertical form: validates, submits and shows the server's error details. */
export function FormModal<T>({
  title,
  okText,
  form,
  onSubmit,
  onClose,
  pending,
  error,
  children,
  initialValues,
  width,
  danger = false,
}: Props<T>) {
  return (
    <Modal
      open
      title={title}
      okText={okText}
      width={width}
      onCancel={onClose}
      okButtonProps={{ loading: pending, danger }}
      onOk={() => form.validateFields().then(onSubmit, () => undefined)}
      destroyOnHidden
    >
      <ErrorAlert error={error} className="mb-16" />
      <Form<T> form={form} layout="vertical" requiredMark="optional" initialValues={initialValues}>
        {children}
      </Form>
    </Modal>
  );
}
