import { Button, Card, Col, Flex, Form, Row, Select } from 'antd';
import { useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { RegisterAgentInput } from '../../api/admin-types';
import type { AgentType, AgentView } from '../../api/types';
import { AgencySelect, useAgencyOptions } from '../../components/admin/AgencySelect';
import { AgentFormFields, type AgentFormValues, toRegisterInput } from '../../components/admin/AgentFormFields';
import { AGENT_TYPE_LABELS, AGENT_TYPES_BY_CHANNEL, PARENT_TYPE } from '../../components/admin/agents';
import { MoneyInput } from '../../components/admin/MoneyInput';
import { ParentAgentSelect } from '../../components/admin/ParentAgentSelect';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { RequirePermission } from '../../components/RequirePermission';
import { P } from '../../utils/permissions';

interface FormValues extends AgentFormValues {
  agencyId: string;
  agentType: AgentType;
  parentAgentId?: string;
  authorityLimit?: number | null;
}

/** BO-05/08: register an agent or bank officer under any agency or bank, subject to approval. */
export default function AgentRegisterPage() {
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const agencies = useAgencyOptions();
  const agencyId = Form.useWatch('agencyId', form);
  const agentType = Form.useWatch('agentType', form);
  const channel = agencies.data?.find((agency) => agency.id === agencyId)?.channel;
  const parentType = agentType ? PARENT_TYPE[agentType] : null;

  const register = useApiMutation((input: RegisterAgentInput) => api.post<AgentView>('/backoffice/agents', input), {
    success: 'Registration submitted for approval. Upload the IC copy to complete it.',
    invalidate: ['/backoffice'],
    onSuccess: (agent) => navigate(`/backoffice/agents/${agent.id}`),
  });

  const submit = (values: FormValues) =>
    register.mutate({
      ...toRegisterInput(values),
      agencyId: values.agencyId,
      agentType: values.agentType,
      parentAgentId: values.parentAgentId,
      authorityLimit: values.authorityLimit ?? undefined,
    });

  return (
    <RequirePermission permission={P.boAgentsManage}>
      <PageHeader title="Register agent or bank officer" breadcrumb={[{ title: 'Agents & bankers', to: '/backoffice/agents' }, { title: 'Register' }]} />
      <Card className="content-card">
        <ErrorAlert error={register.error} className="mb-16" />
        <Form<FormValues> form={form} layout="vertical" requiredMark="optional" initialValues={{ idType: 'NRIC' }} onFinish={submit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="agencyId" label="Agency / bank" rules={[{ required: true, message: 'Choose the agency or bank' }]}>
                <AgencySelect
                  onChange={(id) => {
                    const types = AGENT_TYPES_BY_CHANNEL[agencies.data?.find((agency) => agency.id === id)?.channel ?? 'AGENCY'];
                    form.setFieldsValue({ agentType: types.length === 1 ? types[0] : undefined, parentAgentId: undefined });
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="agentType" label="Type" rules={[{ required: true, message: 'Choose the type' }]}>
                <Select
                  disabled={!channel}
                  options={(channel ? AGENT_TYPES_BY_CHANNEL[channel] : []).map((type) => ({ value: type, label: AGENT_TYPE_LABELS[type] }))}
                  onChange={() => form.setFieldValue('parentAgentId', undefined)}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="authorityLimit" label="Authority limit" extra="Leave empty for no limit">
                <MoneyInput />
              </Form.Item>
            </Col>
            {parentType && (
              <Col xs={24} md={12}>
                <Form.Item
                  name="parentAgentId"
                  label="Reports to"
                  extra={agentType === 'BANKER' ? 'Senior bank officer, if any' : undefined}
                  rules={[{ required: agentType === 'SUB_AGENT', message: 'Choose the main agent' }]}
                >
                  <ParentAgentSelect allowClear agencyId={agencyId} agentType={agentType} placeholder={`Active ${AGENT_TYPE_LABELS[parentType].toLowerCase()} of this ${channel === 'BANCA' ? 'bank' : 'agency'}`} />
                </Form.Item>
              </Col>
            )}
          </Row>
          <AgentFormFields />
          <Flex justify="flex-end" gap={8}>
            <Button onClick={() => navigate('/backoffice/agents')}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={register.isPending}>
              Submit for approval
            </Button>
          </Flex>
        </Form>
      </Card>
    </RequirePermission>
  );
}
