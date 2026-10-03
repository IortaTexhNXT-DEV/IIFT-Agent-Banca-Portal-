import { App, Form, Input } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { SentTo } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { FieldGrid } from '../FieldGrid';
import { FormModal } from './FormModal';

interface Values {
  email?: string;
}

/** AP-62: e-mail the participant a one-time link to review and sign remotely. */
export function SignatureLinkModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<Values>();
  const send = useApiMutation(
    (body: Values) => api.post<SentTo>(`/portal/policies/${policy.id}/signatures/link`, body),
    {
      invalidate: ['/portal/policies'],
      onSuccess: (result) => {
        message.success(`Link sent to ${result.sentTo}`);
        onClose();
      },
    },
  );

  return (
    <FormModal<Values>
      title="Send e-signature link"
      okText="Send link"
      form={form}
      initialValues={{ email: policy.participant.email ?? undefined }}
      onSubmit={(values) => send.mutate({ email: values.email?.trim() })}
      onClose={onClose}
      pending={send.isPending}
      error={send.error}
    >
      <FieldGrid
        columns={2}
        className="mb-16"
        items={[
          { key: 'participant', label: 'Participant', value: policy.participant.fullName },
          { key: 'quotation', label: 'Quotation', value: policy.quotationNo },
        ]}
      />
      <Form.Item
        name="email"
        label="Participant e-mail"
        tooltip="One-time link; expires after the period set by IIFT"
        rules={[
          { required: true, message: 'Enter the e-mail address' },
          { type: 'email', message: 'Enter a valid e-mail address' },
        ]}
      >
        <Input inputMode="email" maxLength={254} />
      </Form.Item>
    </FormModal>
  );
}
