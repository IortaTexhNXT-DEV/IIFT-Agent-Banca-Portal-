import { Alert, Form } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { NomineeInput } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { FormModal } from './FormModal';
import { type NomineeRow, NomineesEditor, toNomineeInputs } from './NomineesEditor';

interface Values {
  nominees: NomineeRow[];
}

/** AP-19: nominees, beneficiaries or executors of a draft application. */
export function NomineesModal({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const [form] = Form.useForm<Values>();
  const save = useApiMutation((nominees: NomineeInput[]) => api.put(`/portal/policies/${policy.id}/nominees`, { nominees }), {
    success: 'Nominees saved',
    invalidate: ['/portal/policies'],
    onSuccess: onClose,
  });
  const existing: NomineeRow[] = policy.nominees.map((nominee) => ({
    fullName: nominee.fullName,
    relationship: nominee.relationship,
    role: nominee.role,
    sharePercent: Number(nominee.sharePercent),
    idNumberMasked: nominee.idNumberMasked,
  }));
  const initialValues: Values = { nominees: existing.length > 0 ? existing : [{ role: 'NOMINEE', sharePercent: 100 }] };

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
      width={1040}
    >
      {policy.nominees.some((nominee) => nominee.idNumberMasked) && (
        <Alert className="mb-16" type="info" showIcon title="Saving replaces the nominee list. Re-enter the IC or passport number of existing nominees to keep it on record." />
      )}
      <NomineesEditor required={policy.product.config.requiresNominee === true} />
    </FormModal>
  );
}
