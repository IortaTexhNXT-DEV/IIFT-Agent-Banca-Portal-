import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Steps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ClaimablePolicy } from '../../api/sales-types';
import type { Claim } from '../../api/types';
import { ActionBar } from '../../components/ActionBar';
import { ErrorAlert } from '../../components/ErrorAlert';
import { FieldGrid } from '../../components/FieldGrid';
import { FormSection } from '../../components/FormSection';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { ISO_DATE } from '../../components/sales/options';
import { useCodes } from '../../components/sales/useCodes';
import { StatusTag } from '../../components/StatusTag';
import { formatDate } from '../../utils/format';
import '../../styles/sales.css';

const STEPS = [{ title: 'Policy' }, { title: 'Event' }, { title: 'Documents' }];

interface Values {
  claimType: string;
  eventDate: Dayjs;
  description: string;
  claimedAmount?: number | null;
}

function SelectedPolicy({ policy, onChange }: { policy: ClaimablePolicy; onChange(): void }) {
  return (
    <div className="selected-record">
      <FieldGrid
        columns={3}
        items={[
          { key: 'policy', label: 'Policy no.', value: policy.policyNo },
          { key: 'status', label: 'Status', value: <StatusTag status={policy.status} /> },
          { key: 'product', label: 'Product', value: policy.product.name },
          { key: 'participant', label: 'Participant', value: policy.participant.fullName },
          {
            key: 'cover',
            label: 'Period of cover',
            value: `${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}`,
          },
          { key: 'sum', label: 'Sum covered', value: <Money value={policy.sumCovered} /> },
        ]}
      />
      <Button onClick={onChange}>Change</Button>
    </div>
  );
}

function ClaimForm({ policy }: { policy: ClaimablePolicy }) {
  const navigate = useNavigate();
  const [form] = Form.useForm<Values>();
  const claimTypes = useCodes('CLAIM_TYPE');
  const create = useApiMutation(
    (values: Values) =>
      api.post<Claim>('/portal/claims', {
        policyId: policy.id,
        claimType: values.claimType,
        eventDate: values.eventDate.format(ISO_DATE),
        description: values.description.trim(),
        claimedAmount: values.claimedAmount ?? undefined,
      }),
    {
      success: 'Claim notified – attach the supporting documents',
      invalidate: ['/portal/claims', '/portal/policies'],
      onSuccess: (claim) => navigate(`/portal/claims/${claim.id}`),
    },
  );
  const coverStart = policy.startDate ? dayjs(policy.startDate) : null;
  const today = dayjs();
  const coverEnd =
    policy.endDate && dayjs(policy.endDate).isBefore(today) ? dayjs(policy.endDate) : today;

  return (
    <Form<Values>
      form={form}
      layout="vertical"
      requiredMark="optional"
      onFinish={(values) => create.mutate(values)}
    >
      <FormSection title="Event" columns={2}>
        <Form.Item
          name="claimType"
          label="Claim type"
          rules={[{ required: true, message: 'Choose the claim type' }]}
        >
          <Select options={claimTypes.options} loading={claimTypes.loading} />
        </Form.Item>
        <Form.Item
          name="eventDate"
          label="Date of event"
          tooltip="Within the period of cover"
          rules={[{ required: true, message: 'Choose the date of the event' }]}
        >
          <DatePicker
            className="full-width"
            format="DD MMM YYYY"
            disabledDate={(date) =>
              (coverStart !== null && date.isBefore(coverStart, 'day')) ||
              date.isAfter(coverEnd, 'day')
            }
          />
        </Form.Item>
        <Form.Item
          name="claimedAmount"
          label="Amount claimed"
          tooltip="If known, e.g. from the hospital bill"
        >
          <InputNumber className="full-width" min={0} precision={2} prefix="B$" />
        </Form.Item>
        <Form.Item
          name="description"
          label="Description of the event"
          className="field--full"
          rules={[
            { required: true, whitespace: true, message: 'Describe the event' },
            { min: 10, max: 2000, message: 'Between 10 and 2,000 characters' },
          ]}
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </FormSection>
      <ErrorAlert error={create.error} className="mb-16" />
      <ActionBar start={<Button onClick={() => navigate('/portal/claims')}>Cancel</Button>}>
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          Notify claim
        </Button>
      </ActionBar>
    </Form>
  );
}

/** AP-43: validate the policy, record the event, then attach supporting documents on the claim page. */
export default function ClaimFormPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [policyNo, setPolicyNo] = useState(params.get('policyNo') ?? '');
  const policy = useApiQuery<ClaimablePolicy>(policyNo ? '/portal/claims/validate-policy' : null, {
    policyNo,
  });

  return (
    <>
      <PageHeader
        title="Notify claim"
        breadcrumb={[
          { title: 'Home', to: '/portal' },
          { title: 'Claims', to: '/portal/claims' },
          { title: 'Notify claim' },
        ]}
      />
      <Card className="content-card">
        <Steps current={policy.data ? 1 : 0} items={STEPS} size="small" className="wizard-steps" />
        {policy.data ? (
          <>
            <SelectedPolicy policy={policy.data} onChange={() => setPolicyNo('')} />
            <ClaimForm key={policy.data.id} policy={policy.data} />
          </>
        ) : (
          <Form layout="vertical" requiredMark="optional">
            <FormSection title="Policy" columns={2}>
              <Form.Item
                label="Policy number"
                required
                tooltip="Active or expired policy, e.g. PRO/26/000001"
                validateStatus={policy.error ? 'error' : undefined}
              >
                <Input.Search
                  aria-label="Policy number"
                  placeholder="PRO/26/000001"
                  enterButton="Validate"
                  defaultValue={policyNo}
                  loading={policy.isFetching}
                  onSearch={(value) => setPolicyNo(value.trim().toUpperCase())}
                />
              </Form.Item>
            </FormSection>
            <ErrorAlert error={policy.error} className="mb-16" />
            <ActionBar start={<Button onClick={() => navigate('/portal/claims')}>Cancel</Button>} />
          </Form>
        )}
      </Card>
    </>
  );
}
