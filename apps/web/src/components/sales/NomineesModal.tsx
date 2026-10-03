import { Alert, Form } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { NomineeInput } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { FormModal } from './FormModal';
import { type NomineeRow, nomineeRows, NomineesEditor, toNomineeInputs } from './NomineesEditor';

interface Values {
  nominees: NomineeRow[];
}

/** AP-19: nominees, beneficiaries or executors of a draft application. */
export function NomineesModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const [form] = Form.useForm<Values>();
  const save = useApiMutation(
    (nominees: NomineeInput[]) => api.put(`/portal/policies/${policy.id}/nominees`, { nominees }),
    {
      success: 'Nominees saved',
      invalidate: ['/portal/policies'],
      onSuccess: onClose,
    },
  );
  const initialValues: Values = { nominees: nomineeRows(policy.nominees) };

  return (
    <FormModal<Values>
      title="Nominees"
      okText="Save nominees"
      form={form}
      initialValues={initialValues}
      onSubmit={(values) => save.mutate(toNomineeInputs(values.nominees))}
      onClose={onClose}
      pending={save.isPending}
      error={save.error}
      errorTitle="Nominees not saved"
      width={1040}
    >
      {policy.nominees.some((nominee) => nominee.idNumberMasked) && (
        <Alert
          className="mb-16"
          type="info"
          showIcon
          title="Leave the IC / passport number blank to keep the number on record"
        />
      )}
      <NomineesEditor required={policy.product.config.requiresNominee === true} />
    </FormModal>
  );
}
