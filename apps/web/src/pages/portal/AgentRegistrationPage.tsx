import { Alert, Button, Card, Form, Select, Steps } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { RegisterAgentInput } from '../../api/admin-types';
import type { Agency, AgentType, AgentView, Page } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ActionBar } from '../../components/ActionBar';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import {
  AgentFormFields,
  type AgentFormValues,
  toRegisterInput,
} from '../../components/admin/AgentFormFields';
import { PARENT_TYPE } from '../../components/admin/agents';
import { ErrorAlert } from '../../components/ErrorAlert';
import { FieldGrid } from '../../components/FieldGrid';
import { FormSection } from '../../components/FormSection';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { P } from '../../utils/permissions';
import '../../styles/sales.css';

interface FormValues extends AgentFormValues {
  parentAgentId?: string;
}

const STEPS = [{ title: 'Applicant' }, { title: 'Documents' }, { title: 'IIFT approval' }];

/** Portal users register sub-agents (agency channel) or bank officers (banca channel). */
const PORTAL_TYPE: Record<Agency['channel'], AgentType> = { AGENCY: 'SUB_AGENT', BANCA: 'BANKER' };

function ReportingLineField({ agentType }: { agentType: AgentType }) {
  const { user, can } = useAuth();
  const parentType = PARENT_TYPE[agentType];
  const candidates = useApiQuery<Page<AgentView>>(parentType ? '/portal/agents' : null, {
    agentType: parentType,
    status: 'ACTIVE',
    pageSize: 100,
  });
  // Without agency-wide access a user may only register agents under themselves.
  const options = (candidates.data?.items ?? [])
    .filter((agent) => can(P.portalAgencyWideView) || agent.id === user?.agentId)
    .map((agent) => ({ value: agent.id, label: `${agent.fullName} (${agent.agentCode})` }));

  if (!parentType) return null;
  return (
    <FormSection title="Reporting line" columns={2}>
      <Form.Item
        name="parentAgentId"
        label="Reports to"
        tooltip={
          agentType === 'BANKER'
            ? 'Empty: the officer reports to no senior bank officer'
            : undefined
        }
        rules={[
          {
            required: agentType === 'SUB_AGENT',
            message: 'Choose the main agent this sub-agent reports to',
          },
        ]}
      >
        <Select
          allowClear={agentType === 'BANKER'}
          loading={candidates.isLoading}
          options={options}
          showSearch={{ optionFilterProp: 'label' }}
        />
      </Form.Item>
    </FormSection>
  );
}

function RegistrationForm({
  agency,
  onRegistered,
}: {
  agency: Agency;
  onRegistered(agent: AgentView): void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const agentType = PORTAL_TYPE[agency.channel];
  const register = useApiMutation(
    (input: RegisterAgentInput) => api.post<AgentView>('/portal/agents', input),
    {
      success: 'Registration submitted',
      invalidate: ['/portal/agents', '/portal/hierarchy', '/portal/agency', '/portal/requests'],
      onSuccess: onRegistered,
    },
  );

  return (
    <Card className="content-card">
      <Steps current={0} items={STEPS} size="small" className="wizard-steps" />
      {agency.status !== 'ACTIVE' && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="Registrations are only accepted while the agency or bank is active"
        />
      )}
      <ErrorAlert error={register.error} className="mb-16" />
      <Form<FormValues>
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ idType: 'NRIC', parentAgentId: user?.agentId }}
        onFinish={(values) =>
          register.mutate({
            ...toRegisterInput(values),
            agentType,
            parentAgentId: values.parentAgentId,
          })
        }
      >
        <ReportingLineField agentType={agentType} />
        <AgentFormFields />
        <ActionBar start={<Button onClick={() => navigate('/portal/team')}>Cancel</Button>}>
          <Button
            type="primary"
            htmlType="submit"
            loading={register.isPending}
            disabled={agency.status !== 'ACTIVE'}
          >
            Submit registration
          </Button>
        </ActionBar>
      </Form>
    </Card>
  );
}

const AML_OUTCOME: Record<string, { type: 'success' | 'warning' | 'info'; title: string }> = {
  CLEAR: { type: 'success', title: 'AML screening clear' },
  FLAGGED: {
    type: 'warning',
    title: 'Possible watch-list match – Compliance clearance required before approval',
  },
  NOT_SCREENED: {
    type: 'info',
    title: 'Not yet screened – IIFT screens the applicant before approval',
  },
};

function RegistrationSubmitted({
  agent,
  onRegisterAnother,
}: {
  agent: AgentView;
  onRegisterAnother(): void;
}) {
  const navigate = useNavigate();
  const aml = AML_OUTCOME[agent.amlStatus] ?? AML_OUTCOME.NOT_SCREENED;
  return (
    <>
      <Card title="Registration submitted" className="content-card">
        <Steps current={1} items={STEPS} size="small" className="wizard-steps" />
        <FieldGrid
          columns={4}
          className="mb-16"
          items={[
            { key: 'code', label: 'Agent code', value: <strong>{agent.agentCode}</strong> },
            { key: 'name', label: 'Name', value: agent.fullName },
            {
              key: 'status',
              label: 'Status',
              value: <StatusTag status={agent.status} label="Pending approval" />,
            },
            {
              key: 'aml',
              label: 'AML screening',
              value: <StatusTag status={agent.amlStatus} />,
            },
          ]}
        />
        <Alert className="mb-16" type={aml.type} showIcon title={aml.title} />
        <Alert
          type="info"
          showIcon
          title="Next: upload the applicant's IC copy – sign-in details are e-mailed once IIFT approves"
          action={
            <Link to="/portal/requests">
              <Button size="small">My requests</Button>
            </Link>
          }
        />
      </Card>
      <Card className="content-card">
        <AgentDocuments
          agentId={agent.id}
          idType={agent.idType}
          channel={agent.agency.channel}
          canUpload
          checkRequired
          title="Supporting documents"
        />
        <ActionBar start={<Button onClick={onRegisterAnother}>Register another</Button>}>
          <Button type="primary" onClick={() => navigate(`/portal/team/${agent.id}`)}>
            View team member
          </Button>
        </ActionBar>
      </Card>
    </>
  );
}

/** AP-07/08/46/48: online registration of a sub-agent or bank officer, AML screening and documents. */
export default function AgentRegistrationPage() {
  const agency = useApiQuery<Agency>('/portal/agency');
  const [registered, setRegistered] = useState<AgentView>();
  const banca = agency.data?.channel === 'BANCA';
  const title = banca ? 'Register bank officer' : 'Register agent';

  return (
    <>
      <PageHeader
        title={title}
        meta={[
          agency.data && {
            label: banca ? 'Bank' : 'Agency',
            value: `${agency.data.name} (${agency.data.code})`,
          },
        ]}
        breadcrumb={[
          { title: 'Home', to: '/portal' },
          { title: 'Team & hierarchy', to: '/portal/team' },
          { title },
        ]}
      />
      <QueryState query={agency}>
        {(data) =>
          registered ? (
            <RegistrationSubmitted
              agent={registered}
              onRegisterAnother={() => setRegistered(undefined)}
            />
          ) : (
            <RegistrationForm agency={data} onRegistered={setRegistered} />
          )
        }
      </QueryState>
    </>
  );
}
