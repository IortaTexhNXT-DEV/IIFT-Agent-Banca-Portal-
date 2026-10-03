import { Button, Form, Input, Radio } from 'antd';
import { useState } from 'react';
import { useParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Claim, ClaimStatus } from '../../api/types';
import { QueryState } from '../../components/QueryState';
import { ClaimDetailView } from '../../components/sales/ClaimDetailView';
import { FormModal } from '../../components/sales/FormModal';
import { humanise } from '../../utils/format';
import '../../styles/sales.css';

/** Allowed status changes, as enforced by the claims service. */
const NEXT_STATUSES: Record<ClaimStatus, ClaimStatus[]> = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['ACKNOWLEDGED', 'REJECTED'],
  ACKNOWLEDGED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CLOSED: [],
};

interface Values {
  status: ClaimStatus;
  remarks: string;
}

function ClaimStatusModal({ claim, onClose }: { claim: Claim; onClose(): void }) {
  const [form] = Form.useForm<Values>();
  const options = NEXT_STATUSES[claim.status];
  const update = useApiMutation(
    (values: Values) =>
      api.put<Claim>(`/backoffice/claims/${claim.id}/status`, {
        status: values.status,
        remarks: values.remarks.trim(),
      }),
    {
      success: { title: 'Claim status updated', description: 'The agent has been notified' },
      invalidate: ['/backoffice/claims', '/backoffice/dashboard'],
      onSuccess: onClose,
    },
  );

  return (
    <FormModal<Values>
      title={`Update ${claim.claimNo}`}
      okText="Update status"
      form={form}
      initialValues={{ status: options[0] }}
      onSubmit={(values) => update.mutate(values)}
      onClose={onClose}
      pending={update.isPending}
      error={update.error}
    >
      <Form.Item name="status" label="New status" rules={[{ required: true }]}>
        <Radio.Group
          optionType="button"
          options={options.map((status) => ({ value: status, label: humanise(status) }))}
        />
      </Form.Item>
      <Form.Item
        name="remarks"
        label="Remarks"
        tooltip="Shared with the agent who notified the claim"
        rules={[
          { required: true, whitespace: true, message: 'Enter the remarks' },
          { min: 3, max: 1000, message: 'Between 3 and 1,000 characters' },
        ]}
      >
        <Input.TextArea rows={3} maxLength={1000} showCount />
      </Form.Item>
    </FormModal>
  );
}

/** BO: claim notification with status tracking (submitted → under review → acknowledged / rejected → closed). */
export default function ClaimDetailPage() {
  const { id } = useParams();
  const [updating, setUpdating] = useState(false);
  const claim = useApiQuery<Claim>(`/backoffice/claims/${id}`);

  return (
    <QueryState query={claim}>
      {(data) => (
        <>
          <ClaimDetailView
            claim={data}
            actions={
              NEXT_STATUSES[data.status].length > 0 && (
                <Button type="primary" onClick={() => setUpdating(true)}>
                  Update status
                </Button>
              )
            }
          />
          {updating && <ClaimStatusModal claim={data} onClose={() => setUpdating(false)} />}
        </>
      )}
    </QueryState>
  );
}
