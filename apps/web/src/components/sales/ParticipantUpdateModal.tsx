import { Form, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { ParticipantInput } from '../../api/sales-types';
import type { ApprovalRequest, Participant } from '../../api/types';
import { FormModal } from './FormModal';
import {
  ParticipantDetailsFields,
  type ParticipantFormValues,
  toParticipantPayload,
} from './ParticipantFields';

type Changes = Partial<ParticipantInput>;

function currentValues(participant: Participant): ParticipantFormValues {
  return {
    fullName: participant.fullName,
    dateOfBirth: participant.dateOfBirth ? dayjs(participant.dateOfBirth) : null,
    nationality: participant.nationality ?? undefined,
    occupation: participant.occupation ?? undefined,
    occupationClass: participant.occupationClass ?? undefined,
    contactPerson: participant.contactPerson ?? undefined,
    mobile: participant.mobile,
    email: participant.email ?? undefined,
    addressLine1: participant.addressLine1,
    addressLine2: participant.addressLine2 ?? undefined,
    postcode: participant.postcode ?? undefined,
    district: participant.district ?? undefined,
  };
}

/** Only the fields that differ from the current profile are submitted. */
function changedFields(participant: Participant, values: ParticipantFormValues): Changes {
  const before = toParticipantPayload(currentValues(participant));
  const after = toParticipantPayload(values);
  return Object.fromEntries(
    Object.entries(after).filter(([key, value]) => before[key as keyof Changes] !== value),
  ) as Changes;
}

/** AP-15: changes to a participant's particulars are applied after back-office approval. */
export function ParticipantUpdateModal({
  participant,
  onClose,
}: {
  participant: Participant;
  onClose(): void;
}) {
  const [form] = Form.useForm<ParticipantFormValues>();
  const [unchanged, setUnchanged] = useState(false);
  const request = useApiMutation(
    (changes: Changes) =>
      api.post<ApprovalRequest>(`/portal/participants/${participant.id}/update-requests`, changes),
    {
      success: 'Update request submitted for approval',
      invalidate: ['/portal/participants', '/portal/requests'],
      onSuccess: onClose,
    },
  );

  const submit = (values: ParticipantFormValues) => {
    const changes = changedFields(participant, values);
    setUnchanged(Object.keys(changes).length === 0);
    if (Object.keys(changes).length > 0) request.mutate(changes);
  };

  return (
    <FormModal<ParticipantFormValues>
      title={`Request update – ${participant.participantNo}`}
      okText="Submit for approval"
      form={form}
      initialValues={currentValues(participant)}
      onSubmit={submit}
      onClose={onClose}
      pending={request.isPending}
      error={request.error}
      width={760}
    >
      <Typography.Paragraph type={unchanged ? 'danger' : 'secondary'}>
        {unchanged
          ? 'Nothing has been changed yet.'
          : 'Edit the particulars that have changed. The profile is updated once IIFT approves the request.'}
      </Typography.Paragraph>
      <ParticipantDetailsFields individual={participant.type === 'INDIVIDUAL'} />
    </FormModal>
  );
}
