import { Modal } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { PolicyDetail } from '../../api/types';
import { ErrorAlert } from '../ErrorAlert';
import { FieldGrid } from '../FieldGrid';
import { SignaturePad } from '../SignaturePad';

export type Signer = 'PARTICIPANT' | 'AGENT';

const DECLARATIONS: Record<Signer, string> = {
  PARTICIPANT:
    'I declare that the information given in this application is true and complete, and I agree to participate in the takaful scheme on the terms of the product disclosure sheet.',
  AGENT:
    'I confirm that I explained the product, its benefits and exclusions to the participant and witnessed the participant’s signature.',
};

/** AP-62: on-screen signature of the participant or agent, stored against the application. */
export function SignatureModal({
  policy,
  signer,
  onClose,
}: {
  policy: PolicyDetail;
  signer: Signer;
  onClose(): void;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const capture = useApiMutation(
    (imageDataUrl: string) =>
      api.post(`/portal/policies/${policy.id}/signatures`, { signer, imageDataUrl }),
    {
      success: 'Signature recorded',
      invalidate: ['/portal/policies', '/common/documents'],
      onSuccess: onClose,
    },
  );
  const name = signer === 'PARTICIPANT' ? policy.participant.fullName : policy.agent.fullName;

  return (
    <Modal
      open
      title={signer === 'PARTICIPANT' ? 'Participant signature' : 'Agent signature'}
      okText="Save signature"
      okButtonProps={{ disabled: !signature, loading: capture.isPending }}
      onOk={() => signature && capture.mutate(signature)}
      onCancel={onClose}
      destroyOnHidden
      width={600}
    >
      <ErrorAlert error={capture.error} title="Signature not recorded" className="mb-16" />
      <FieldGrid
        columns={2}
        className="mb-16"
        items={[
          { key: 'signer', label: 'Signing as', value: name },
          { key: 'quotation', label: 'Quotation', value: policy.quotationNo },
        ]}
      />
      <p className="declaration">{DECLARATIONS[signer]}</p>
      <SignaturePad onChange={setSignature} />
    </Modal>
  );
}
