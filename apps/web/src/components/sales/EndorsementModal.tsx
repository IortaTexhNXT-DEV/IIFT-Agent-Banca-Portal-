import { Form, Input, Select } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { NomineeInput } from '../../api/sales-types';
import type { ApprovalRequest, PolicyDetail } from '../../api/types';
import { FormModal } from './FormModal';
import { type NomineeRow, nomineeRows, NomineesEditor, toNomineeInputs } from './NomineesEditor';
import { useCodes } from './useCodes';

interface Values {
  endorsementType: string;
  description: string;
  nominees?: NomineeRow[];
}

interface Body {
  endorsementType: string;
  description: string;
  nominees?: NomineeInput[];
}

const NOMINEE_CHANGE = 'NOMINEE_CHANGE';

/** AP-27: request a change to an active policy; applied after IIFT approval. */
export function EndorsementModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const [form] = Form.useForm<Values>();
  const types = useCodes('ENDORSEMENT_TYPE');
  const type = Form.useWatch('endorsementType', form);
  const request = useApiMutation(
    (body: Body) => api.post<ApprovalRequest>(`/portal/policies/${policy.id}/endorsements`, body),
    {
      success: 'Endorsement request submitted for approval',
      invalidate: ['/portal/policies', '/portal/requests'],
      onSuccess: onClose,
    },
  );

  const submit = ({ endorsementType, description, nominees }: Values) =>
    request.mutate({
      endorsementType,
      description: description.trim(),
      nominees: endorsementType === NOMINEE_CHANGE ? toNomineeInputs(nominees) : undefined,
    });

  return (
    <FormModal<Values>
      title={`Endorsement – ${policy.policyNo}`}
      okText="Submit request"
      form={form}
      initialValues={{ nominees: nomineeRows(policy.nominees) }}
      onSubmit={submit}
      onClose={onClose}
      pending={request.isPending}
      error={request.error}
      width={type === NOMINEE_CHANGE ? 1040 : 560}
    >
      <Form.Item
        name="endorsementType"
        label="Endorsement type"
        rules={[{ required: true, message: 'Choose the type of change' }]}
      >
        <Select options={types.options} loading={types.loading} />
      </Form.Item>
      <Form.Item
        name="description"
        label="Description of the change"
        rules={[
          { required: true, whitespace: true, message: 'Describe the change' },
          { min: 5, max: 1000, message: 'Between 5 and 1,000 characters' },
        ]}
      >
        <Input.TextArea rows={3} maxLength={1000} showCount />
      </Form.Item>
      {type === NOMINEE_CHANGE && <NomineesEditor required />}
    </FormModal>
  );
}
