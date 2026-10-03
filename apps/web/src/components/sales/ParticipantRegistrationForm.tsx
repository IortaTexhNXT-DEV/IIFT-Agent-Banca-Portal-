import { Alert, Button, Form, Input, Radio, Segmented } from 'antd';
import { type ReactNode, useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { ParticipantInput, ParticipantLookup, ParticipantMatch } from '../../api/sales-types';
import type { Participant } from '../../api/types';
import { ActionBar } from '../ActionBar';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { ID_TYPE_LABELS } from './options';
import {
  ParticipantDetailsFields,
  type ParticipantFormValues,
  toParticipantPayload,
} from './ParticipantFields';

interface Props {
  submitLabel: string;
  onCreated(participant: Participant): void;
  /** Action offered when the ID number is already registered (single shared profile, AP-11). */
  renderDuplicateAction(match: ParticipantMatch): ReactNode;
  onCancel?(): void;
  /** e.g. the ID type and number from an unsuccessful lookup. */
  initialValues?: ParticipantFormValues;
}

const INDIVIDUAL_ID_TYPES = ['NRIC', 'PASSPORT'] as const;

/** AP-13: register an individual or corporate participant; screened for AML on creation. */
export function ParticipantRegistrationForm({
  submitLabel,
  onCreated,
  renderDuplicateAction,
  onCancel,
  initialValues,
}: Props) {
  const [form] = Form.useForm<ParticipantFormValues>();
  const type = Form.useWatch('type', form) ?? 'INDIVIDUAL';
  const individual = type === 'INDIVIDUAL';
  const [duplicate, setDuplicate] = useState<ParticipantMatch | null>(null);

  const create = useApiMutation(
    (values: ParticipantFormValues) =>
      api.post<Participant>(
        '/portal/participants',
        toParticipantPayload(values) as ParticipantInput,
      ),
    {
      invalidate: ['/portal/participants'],
      onSuccess: onCreated,
      onError: async (error, values) => {
        if (error.code !== 'DUPLICATE_PARTICIPANT' || !values.idType || !values.idNumber) return;
        // The error only names the existing record; the lookup returns its masked summary.
        const lookup = await api
          .get<ParticipantLookup>('/portal/participants/lookup', {
            idType: values.idType,
            idNumber: values.idNumber.trim(),
          })
          .catch(() => null);
        setDuplicate(lookup?.found ? lookup.participant : null);
      },
    },
  );

  const submit = (values: ParticipantFormValues) => {
    setDuplicate(null);
    create.mutate(values);
  };

  return (
    <Form<ParticipantFormValues>
      form={form}
      layout="vertical"
      requiredMark="optional"
      initialValues={{ type: 'INDIVIDUAL', idType: 'NRIC', ...initialValues }}
      onFinish={submit}
      onValuesChange={(changed: ParticipantFormValues) => {
        if (changed.type)
          form.setFieldsValue({ idType: changed.type === 'CORPORATE' ? 'BUSINESS_REG' : 'NRIC' });
      }}
    >
      <FormSection title="Identification" columns={2}>
        <Form.Item name="type" label="Participant type" rules={[{ required: true }]}>
          <Segmented
            options={[
              { value: 'INDIVIDUAL', label: 'Individual' },
              { value: 'CORPORATE', label: 'Corporate' },
            ]}
          />
        </Form.Item>
        <Form.Item name="idType" label="ID type" rules={[{ required: true }]}>
          <Radio.Group
            optionType="button"
            options={(individual ? INDIVIDUAL_ID_TYPES : (['BUSINESS_REG'] as const)).map(
              (value) => ({ value, label: ID_TYPE_LABELS[value] }),
            )}
          />
        </Form.Item>
        <Form.Item
          name="idNumber"
          label="ID number"
          rules={[
            { required: true, message: 'Enter the ID number' },
            {
              pattern: /^[A-Za-z0-9-/ ]{5,30}$/,
              message: '5 to 30 letters, digits, spaces, - or /',
            },
          ]}
        >
          <Input maxLength={30} autoComplete="off" />
        </Form.Item>
        {individual && (
          <Form.Item name="gender" label="Gender">
            <Radio.Group
              options={[
                { value: 'MALE', label: 'Male' },
                { value: 'FEMALE', label: 'Female' },
              ]}
            />
          </Form.Item>
        )}
      </FormSection>

      <FormSection title={individual ? 'Personal details' : 'Company details'} columns={2}>
        <ParticipantDetailsFields individual={individual} />
      </FormSection>

      {duplicate ? (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title={`Already registered as ${duplicate.participantNo} (${duplicate.fullName}) – use the existing profile`}
          action={renderDuplicateAction(duplicate)}
        />
      ) : (
        <ErrorAlert error={create.error} className="mb-16" />
      )}
      <ActionBar start={onCancel && <Button onClick={onCancel}>Cancel</Button>}>
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          {submitLabel}
        </Button>
      </ActionBar>
    </Form>
  );
}
