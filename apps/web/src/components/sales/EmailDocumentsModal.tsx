import { App, Form, Input, Typography } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { SentTo } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { FormModal } from './FormModal';
import { useSalesLinks } from './useSalesLinks';

interface Values {
  email?: string;
}

/** Documents are e-mailed once the e-Policy schedule or an e-Receipt has been issued. */
export function hasIssuedDocuments(policy: PolicyDetail): boolean {
  return policy.documents.some((doc) => doc.docType === 'POLICY_SCHEDULE' || doc.docType === 'RECEIPT');
}

/** AP-45: e-mail the e-Policy schedule and e-Receipts to the participant (or another address). */
export function EmailDocumentsModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const { message } = App.useApp();
  const links = useSalesLinks();
  const [form] = Form.useForm<Values>();
  // The API path matches the module route: /portal/policies/:id or /backoffice/policies/:id.
  const send = useApiMutation((body: Values) => api.post<SentTo>(`${links.policy(policy.id)}/email-documents`, body), {
    invalidate: [links.policy(policy.id)],
    onSuccess: (result) => {
      message.success(`Policy documents sent to ${result.sentTo}`);
      onClose();
    },
  });

  return (
    <FormModal<Values>
      title="E-mail policy documents"
      okText="Send"
      form={form}
      initialValues={{ email: policy.participant.email ?? undefined }}
      onSubmit={(values) => send.mutate({ email: values.email?.trim() || undefined })}
      onClose={onClose}
      pending={send.isPending}
      error={send.error}
    >
      <Typography.Paragraph>The e-Policy schedule and e-Receipts of {policy.policyNo ?? policy.quotationNo} are attached to the e-mail.</Typography.Paragraph>
      <Form.Item name="email" label="Send to" extra="Defaults to the participant's e-mail address" rules={[{ type: 'email', message: 'Enter a valid e-mail address' }]}>
        <Input inputMode="email" maxLength={254} placeholder={policy.participant.email ?? undefined} />
      </Form.Item>
    </FormModal>
  );
}
