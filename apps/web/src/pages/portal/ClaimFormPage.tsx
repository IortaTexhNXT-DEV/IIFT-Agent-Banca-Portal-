import { Button, Card, Col, DatePicker, Descriptions, Flex, Form, Input, InputNumber, Row, Select, Steps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ClaimablePolicy } from '../../api/sales-types';
import type { Claim } from '../../api/types';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { ISO_DATE } from '../../components/sales/options';
import { useCodes } from '../../components/sales/useCodes';
import { formatDate } from '../../utils/format';
import '../../styles/sales.css';

interface Values {
  claimType: string;
  eventDate: Dayjs;
  description: string;
  claimedAmount?: number | null;
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
  const coverEnd = policy.endDate && dayjs(policy.endDate).isBefore(today) ? dayjs(policy.endDate) : today;

  return (
    <Form<Values> form={form} layout="vertical" requiredMark="optional" onFinish={(values) => create.mutate(values)}>
      <ErrorAlert error={create.error} className="mb-16" />
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="claimType" label="Claim type" rules={[{ required: true, message: 'Choose the claim type' }]}>
            <Select options={claimTypes.options} loading={claimTypes.loading} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="eventDate" label="Date of event" extra="Must fall within the period of cover" rules={[{ required: true, message: 'Choose the date of the event' }]}>
            <DatePicker
              className="full-width"
              format="DD MMM YYYY"
              disabledDate={(date) => (coverStart !== null && date.isBefore(coverStart, 'day')) || date.isAfter(coverEnd, 'day')}
            />
          </Form.Item>
        </Col>
        <Col xs={24}>
          <Form.Item
            name="description"
            label="What happened"
            rules={[
              { required: true, whitespace: true, message: 'Describe the event' },
              { min: 10, max: 2000, message: 'Between 10 and 2,000 characters' },
            ]}
          >
            <Input.TextArea rows={4} maxLength={2000} showCount />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="claimedAmount" label="Amount claimed" extra="If known, e.g. from the hospital bill">
            <InputNumber className="full-width" min={0} precision={2} prefix="B$" />
          </Form.Item>
        </Col>
      </Row>
      <Flex justify="flex-end" gap={8}>
        <Button onClick={() => navigate('/portal/claims')}>Cancel</Button>
        <Button type="primary" htmlType="submit" loading={create.isPending}>
          Notify claim
        </Button>
      </Flex>
    </Form>
  );
}

/** AP-43: validate the policy, record the event, then attach supporting documents on the claim page. */
export default function ClaimFormPage() {
  const [params] = useSearchParams();
  const [policyNo, setPolicyNo] = useState(params.get('policyNo') ?? '');
  const policy = useApiQuery<ClaimablePolicy>(policyNo ? '/portal/claims/validate-policy' : null, { policyNo });

  return (
    <>
      <PageHeader title="Notify claim" breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Claims', to: '/portal/claims' }, { title: 'Notify claim' }]} />
      <Card className="content-card">
        <Steps
          current={policy.data ? 1 : 0}
          className="wizard-steps"
          items={[
            { title: 'Policy', content: 'Validate the policy number' },
            { title: 'Event', content: 'Describe what happened' },
            { title: 'Documents', content: 'Attach on the claim page' },
          ]}
        />
        <Input.Search
          aria-label="Policy number"
          placeholder="Policy number, e.g. PRO/26/000001"
          enterButton="Validate"
          defaultValue={policyNo}
          loading={policy.isFetching}
          onSearch={(value) => setPolicyNo(value.trim().toUpperCase())}
          className="policy-search mb-16"
        />
        <ErrorAlert error={policy.error} className="mb-16" />
        {policy.data && (
          <>
            <Card size="small" className="content-card">
              <Descriptions
                size="small"
                column={{ xs: 1, md: 3 }}
                items={[
                  { key: 'policy', label: 'Policy no.', children: policy.data.policyNo },
                  { key: 'status', label: 'Status', children: <StatusTag status={policy.data.status} /> },
                  { key: 'product', label: 'Product', children: policy.data.product.name },
                  { key: 'participant', label: 'Participant', children: policy.data.participant.fullName },
                  { key: 'cover', label: 'Period of cover', children: `${formatDate(policy.data.startDate)} to ${formatDate(policy.data.endDate)}` },
                  { key: 'sum', label: 'Sum covered', children: <Money value={policy.data.sumCovered} /> },
                ]}
              />
            </Card>
            <ClaimForm key={policy.data.id} policy={policy.data} />
          </>
        )}
      </Card>
    </>
  );
}
