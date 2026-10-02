import { Alert, Button, DatePicker, Form, Input, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { AgentUpdateInput, ManagedAgentStatus } from '../../api/admin-types';
import type { AgentDetail, ApprovalRequest } from '../../api/types';
import { humanise } from '../../utils/format';
import { ActionBar } from '../ActionBar';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { isoDate, mobileRule, optional } from './AgentFormFields';
import { PARENT_TYPE, STATUS_TRANSITIONS } from './agents';
import { MoneyInput } from './MoneyInput';
import { ParentAgentSelect } from './ParentAgentSelect';
import { enumOptions } from './useCodes';

const INVALIDATE = ['/backoffice'];

interface UpdateValues {
  fullName: string;
  email: string;
  mobile: string;
  address?: string;
  branchName?: string;
  dateOfBirth?: Dayjs;
  licenceNo?: string;
  licenceExpiry?: Dayjs;
  authorityLimit?: number | null;
  parentAgentId?: string | null;
}

const day = (value: string | null) => (value ? dayjs(value) : undefined);
const numberOrNull = (value: string | number | null | undefined) =>
  value === null || value === undefined ? null : Number(value);

/** Only fields that differ from the current profile are submitted for approval. */
function changes(agent: AgentDetail, values: UpdateValues): AgentUpdateInput {
  const next: AgentUpdateInput = {
    fullName: values.fullName.trim(),
    email: values.email.trim(),
    mobile: values.mobile.trim(),
    address: optional(values.address),
    branchName: optional(values.branchName),
    dateOfBirth: isoDate(values.dateOfBirth),
    licenceNo: optional(values.licenceNo),
    licenceExpiry: isoDate(values.licenceExpiry),
    authorityLimit: numberOrNull(values.authorityLimit),
    parentAgentId: values.parentAgentId ?? null,
  };
  const current: AgentUpdateInput = {
    fullName: agent.fullName,
    email: agent.email,
    mobile: agent.mobile,
    address: agent.address ?? undefined,
    branchName: agent.branchName ?? undefined,
    dateOfBirth: isoDate(day(agent.dateOfBirth)),
    licenceNo: agent.licenceNo ?? undefined,
    licenceExpiry: isoDate(day(agent.licenceExpiry)),
    authorityLimit: numberOrNull(agent.authorityLimit),
    parentAgentId: agent.parentAgentId,
  };
  const keys = Object.keys(next) as (keyof AgentUpdateInput)[];
  // Optional text fields cannot be blanked through the API, so an emptied field is not a change.
  return Object.fromEntries(
    keys
      .filter((key) => next[key] !== current[key] && next[key] !== undefined)
      .map((key) => [key, next[key]]),
  );
}

interface FormProps {
  agent: AgentDetail;
  /** Called after the request is submitted, and by the Cancel button. */
  onDone?(): void;
}

/** BO-05/08: request a change to an agent's profile, reporting line or authority limit. */
export function AgentUpdateForm({ agent, onDone }: FormProps) {
  const [form] = Form.useForm<UpdateValues>();
  const [unchanged, setUnchanged] = useState(false);
  const parentType = PARENT_TYPE[agent.agentType];
  const request = useApiMutation(
    (input: AgentUpdateInput) =>
      api.post<ApprovalRequest>(`/backoffice/agents/${agent.id}/update-requests`, input),
    {
      success: 'Profile update submitted for approval',
      invalidate: INVALIDATE,
      onSuccess: onDone,
    },
  );
  const submit = (values: UpdateValues) => {
    const input = changes(agent, values);
    setUnchanged(Object.keys(input).length === 0);
    if (Object.keys(input).length > 0) request.mutate(input);
  };

  return (
    <>
      {unchanged && (
        <Alert className="mb-16" type="warning" showIcon title="No field has been changed" />
      )}
      <ErrorAlert error={request.error} className="mb-16" />
      <Form
        form={form}
        onFinish={submit}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          fullName: agent.fullName,
          email: agent.email,
          mobile: agent.mobile,
          address: agent.address ?? '',
          branchName: agent.branchName ?? '',
          dateOfBirth: day(agent.dateOfBirth),
          licenceNo: agent.licenceNo ?? '',
          licenceExpiry: day(agent.licenceExpiry),
          authorityLimit: numberOrNull(agent.authorityLimit),
          parentAgentId: agent.parentAgentId ?? undefined,
        }}
      >
        <FormSection title="Identity">
          <Form.Item
            name="fullName"
            label="Full name"
            rules={[
              { required: true, whitespace: true, message: 'Enter the full name' },
              { min: 2, max: 150 },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="dateOfBirth" label="Date of birth">
            <DatePicker
              format="DD MMM YYYY"
              style={{ width: '100%' }}
              disabledDate={(date) => date.isAfter(dayjs(), 'day')}
            />
          </Form.Item>
        </FormSection>
        <FormSection title="Contact">
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Enter the email address' },
              { type: 'email', message: 'Enter a valid email address' },
            ]}
          >
            <Input type="email" />
          </Form.Item>
          <Form.Item
            name="mobile"
            label="Mobile"
            rules={[{ required: true, message: 'Enter the mobile number' }, mobileRule]}
          >
            <Input inputMode="tel" />
          </Form.Item>
          <Form.Item name="address" label="Address" rules={[{ max: 300 }]} className="field--full">
            <Input />
          </Form.Item>
          <Form.Item name="branchName" label="Branch" rules={[{ max: 100 }]}>
            <Input />
          </Form.Item>
        </FormSection>
        <FormSection title="Licence & authority">
          <Form.Item name="licenceNo" label="Licence no." rules={[{ max: 50 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="licenceExpiry" label="Licence expiry">
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="authorityLimit" label="Authority limit" tooltip="Empty for no limit">
            <MoneyInput />
          </Form.Item>
          {parentType && (
            <Form.Item
              name="parentAgentId"
              label="Reports to"
              rules={[
                {
                  required: agent.agentType === 'SUB_AGENT',
                  message: 'Choose the main agent',
                },
              ]}
            >
              <ParentAgentSelect
                allowClear={agent.agentType === 'BANKER'}
                agencyId={agent.agencyId}
                agentType={agent.agentType}
                excludeId={agent.id}
              />
            </Form.Item>
          )}
        </FormSection>
        <ActionBar start={onDone && <Button onClick={onDone}>Cancel</Button>}>
          <Button type="primary" htmlType="submit" loading={request.isPending}>
            Submit for approval
          </Button>
        </ActionBar>
      </Form>
    </>
  );
}

interface StatusValues {
  status: ManagedAgentStatus;
  reason: string;
}

/** BO-07: activate, deactivate, suspend or terminate an agent, subject to approval. */
export function AgentStatusForm({ agent, onDone }: FormProps) {
  const [form] = Form.useForm<StatusValues>();
  const request = useApiMutation(
    (values: StatusValues) =>
      api.post<ApprovalRequest>(`/backoffice/agents/${agent.id}/status-requests`, {
        ...values,
        reason: values.reason.trim(),
      }),
    {
      success: 'Status change submitted for approval',
      invalidate: INVALIDATE,
      onSuccess: onDone,
    },
  );

  return (
    <>
      <ErrorAlert error={request.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => request.mutate(values)}
        layout="vertical"
        requiredMark="optional"
      >
        <FormSection title="Status change">
          <Form.Item label="Current status" required>
            <Input value={humanise(agent.status)} readOnly />
          </Form.Item>
          <Form.Item
            name="status"
            label="New status"
            rules={[{ required: true, message: 'Choose the new status' }]}
          >
            <Select
              placeholder="Choose"
              options={enumOptions(STATUS_TRANSITIONS[agent.status], humanise)}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            className="field--full"
            rules={[
              { required: true, whitespace: true, message: 'Give the reason' },
              { min: 3, max: 300 },
            ]}
          >
            <Input.TextArea rows={3} maxLength={300} showCount />
          </Form.Item>
        </FormSection>
        <ActionBar start={onDone && <Button onClick={onDone}>Cancel</Button>}>
          <Button type="primary" htmlType="submit" loading={request.isPending}>
            Submit for approval
          </Button>
        </ActionBar>
      </Form>
    </>
  );
}
