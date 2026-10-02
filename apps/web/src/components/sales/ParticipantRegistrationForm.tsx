import { Alert, Button, Col, Flex, Form, Input, Radio, Row, Segmented, Typography } from 'antd';
import { type ReactNode, useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { ParticipantInput, ParticipantLookup, ParticipantMatch } from '../../api/sales-types';
import type { Participant } from '../../api/types';
import { ErrorAlert } from '../ErrorAlert';
import { ID_TYPE_LABELS } from './options';
import { ParticipantDetailsFields, type ParticipantFormValues, toParticipantPayload } from './ParticipantFields';

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
export function ParticipantRegistrationForm({ submitLabel, onCreated, renderDuplicateAction, onCancel, initialValues }: Props) {
  const [form] = Form.useForm<ParticipantFormValues>();
  const type = Form.useWatch('type', form) ?? 'INDIVIDUAL';
  const individual = type === 'INDIVIDUAL';
  const [duplicate, setDuplicate] = useState<ParticipantMatch | null>(null);

  const create = useApiMutation((values: ParticipantFormValues) => api.post<Participant>('/portal/participants', toParticipantPayload(values) as ParticipantInput), {
    invalidate: ['/portal/participants'],
    onSuccess: onCreated,
    onError: async (error, values) => {
      if (error.code !== 'DUPLICATE_PARTICIPANT' || !values.idType || !values.idNumber) return;
      // The error only names the existing record; the lookup returns its masked summary.
      const lookup = await api.get<ParticipantLookup>('/portal/participants/lookup', { idType: values.idType, idNumber: values.idNumber.trim() }).catch(() => null);
      setDuplicate(lookup?.found ? lookup.participant : null);
    },
  });

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
        if (changed.type) form.setFieldsValue({ idType: changed.type === 'CORPORATE' ? 'BUSINESS_REG' : 'NRIC' });
      }}
    >
      {duplicate ? (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title={`${duplicate.fullName} is already registered as ${duplicate.participantNo}`}
          description="Each participant has a single profile shared across agencies. Use the existing record instead of registering again."
          action={renderDuplicateAction(duplicate)}
        />
      ) : (
        <ErrorAlert error={create.error} className="mb-16" />
      )}

      <Form.Item name="type" label="Participant type">
        <Segmented
          options={[
            { value: 'INDIVIDUAL', label: 'Individual' },
            { value: 'CORPORATE', label: 'Corporate' },
          ]}
        />
      </Form.Item>

      <Typography.Title level={5} className="form-section-title">
        Identification
      </Typography.Title>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="idType" label="ID type" rules={[{ required: true }]}>
            <Radio.Group
              optionType="button"
              options={(individual ? INDIVIDUAL_ID_TYPES : (['BUSINESS_REG'] as const)).map((value) => ({ value, label: ID_TYPE_LABELS[value] }))}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item
            name="idNumber"
            label="ID number"
            rules={[
              { required: true, message: 'Enter the ID number' },
              { pattern: /^[A-Za-z0-9-/ ]{5,30}$/, message: '5 to 30 letters, digits, spaces, - or /' },
            ]}
          >
            <Input maxLength={30} autoComplete="off" />
          </Form.Item>
        </Col>
        {individual && (
          <Col xs={24} md={12}>
            <Form.Item name="gender" label="Gender">
              <Radio.Group
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                ]}
              />
            </Form.Item>
          </Col>
        )}
      </Row>

      <Typography.Title level={5} className="form-section-title">
        {individual ? 'Personal details' : 'Company details'}
      </Typography.Title>
      <ParticipantDetailsFields individual={individual} />

      <Flex gap={8} justify="flex-end">
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          {submitLabel}
        </Button>
      </Flex>
    </Form>
  );
}
