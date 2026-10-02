import { Alert, Button, Card, Col, Descriptions, Flex, Form, Row, Select, Steps } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { RegisterAgentInput } from '../../api/admin-types';
import type { Agency, AgentType, AgentView, Page } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import {
  AgentFormFields,
  type AgentFormValues,
  toRegisterInput,
} from '../../components/admin/AgentFormFields';
import { AGENT_TYPE_LABELS, PARENT_TYPE } from '../../components/admin/agents';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { P } from '../../utils/permissions';

interface FormValues extends AgentFormValues {
  parentAgentId?: string;
}

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
    <Form.Item
      name="parentAgentId"
      label="Reports to"
      extra={
        agentType === 'BANKER'
          ? 'Leave empty if the officer does not report to a senior bank officer'
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
    <Card title={`${AGENT_TYPE_LABELS[agentType]} details`} className="content-card">
      {agency.status !== 'ACTIVE' && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="Registrations are only accepted while your agency or bank is active"
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
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <ReportingLineField agentType={agentType} />
          </Col>
        </Row>
        <AgentFormFields />
        <Flex justify="flex-end">
          <Button
            type="primary"
            htmlType="submit"
            loading={register.isPending}
            disabled={agency.status !== 'ACTIVE'}
          >
            Submit registration
          </Button>
        </Flex>
      </Form>
    </Card>
  );
}

const AML_OUTCOME: Record<string, { type: 'success' | 'warning' | 'info'; text: string }> = {
  CLEAR: { type: 'success', text: 'No watch-list match was found.' },
  FLAGGED: {
    type: 'warning',
    text: 'A possible watch-list match was found. IIFT Compliance will review it before the registration can be approved.',
  },
  NOT_SCREENED: {
    type: 'info',
    text: 'Screening has not been completed yet. IIFT will screen the applicant before approval.',
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
        <Descriptions
          size="small"
          column={{ xs: 1, md: 3 }}
          className="mb-16"
          items={[
            { key: 'code', label: 'Agent code', children: <strong>{agent.agentCode}</strong> },
            { key: 'name', label: 'Name', children: agent.fullName },
            {
              key: 'status',
              label: 'Status',
              children: <StatusTag status={agent.status} label="Pending approval" />,
            },
            {
              key: 'aml',
              label: 'AML screening',
              children: <StatusTag status={agent.amlStatus} />,
            },
          ]}
        />
        <Alert
          className="mb-16"
          type={aml.type}
          showIcon
          title="AML/KYC screening"
          description={aml.text}
        />
        <Alert
          type="info"
          showIcon
          title="Next steps"
          description="Upload a copy of the applicant's IC below. IIFT then reviews the registration; once approved, the portal login is created and the sign-in details are sent to the applicant's email. You can follow the request under My requests."
        />
      </Card>
      <Card className="content-card">
        <AgentDocuments
          agentId={agent.id}
          channel={agent.agency.channel}
          canUpload
          checkRequired
          title="Supporting documents"
        />
      </Card>
      <Flex gap={8} justify="flex-end">
        <Button onClick={onRegisterAnother}>Register another</Button>
        <Button type="primary" onClick={() => navigate(`/portal/team/${agent.id}`)}>
          View team member
        </Button>
      </Flex>
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
        subtitle={agency.data && `Registering under ${agency.data.name} (${agency.data.code})`}
        breadcrumb={[{ title: 'Team & hierarchy', to: '/portal/team' }, { title }]}
      />
      <Card className="content-card">
        <Steps
          current={registered ? 1 : 0}
          items={[
            { title: 'Applicant details', content: 'Identity, contact and licence' },
            { title: 'Documents', content: 'IC copy and supporting files' },
            { title: 'IIFT approval', content: 'Screening and verification' },
          ]}
        />
      </Card>
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
