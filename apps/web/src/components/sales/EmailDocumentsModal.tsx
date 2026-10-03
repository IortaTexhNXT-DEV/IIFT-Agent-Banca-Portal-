import { App, Form, Input } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { SentTo } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { FieldGrid } from '../FieldGrid';
import { FormModal } from './FormModal';
import { useSalesLinks } from './useSalesLinks';

interface Values {
  email?: string;
}

/** Documents are e-mailed once the e-Policy schedule or an e-Receipt has been issued. */
export function hasIssuedDocuments(policy: PolicyDetail): boolean {
  return policy.documents.some(
    (doc) => doc.docType === 'POLICY_SCHEDULE' || doc.docType === 'RECEIPT',
  );
}

const ISSUED_LABELS: Record<string, string> = {
  POLICY_SCHEDULE: 'e-Policy schedule',
  RECEIPT: 'e-Receipt',
};

function issuedDocuments(policy: PolicyDetail): string[] {
  return [...new Set(policy.documents.map((doc) => ISSUED_LABELS[doc.docType]).filter(Boolean))];
}

/** AP-45: e-mail the e-Policy schedule and e-Receipts to the participant (or another address). */
export function EmailDocumentsModal({
  policy,
  onClose,
}: {
  policy: PolicyDetail;
  onClose(): void;
}) {
  const { message } = App.useApp();
  const links = useSalesLinks();
  const [form] = Form.useForm<Values>();
  // The API path matches the module route: /portal/policies/:id or /backoffice/policies/:id.
  const send = useApiMutation(
    (body: Values) => api.post<SentTo>(`${links.policy(policy.id)}/email-documents`, body),
    {
      invalidate: [links.policy(policy.id)],
      onSuccess: (result) => {
        message.success(`Policy documents sent to ${result.sentTo}`);
        onClose();
      },
    },
  );

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
      <FieldGrid
        columns={2}
        className="mb-16"
        items={[
          { key: 'policy', label: 'Policy', value: policy.policyNo ?? policy.quotationNo },
          {
            key: 'documents',
            label: 'Attachments',
            value: issuedDocuments(policy).join(', '),
          },
        ]}
      />
      <Form.Item
        name="email"
        label="Send to"
        tooltip="Empty: the participant's e-mail address"
        rules={[{ type: 'email', message: 'Enter a valid e-mail address' }]}
      >
        <Input
          inputMode="email"
          maxLength={254}
          placeholder={policy.participant.email ?? undefined}
        />
      </Form.Item>
    </FormModal>
  );
}
