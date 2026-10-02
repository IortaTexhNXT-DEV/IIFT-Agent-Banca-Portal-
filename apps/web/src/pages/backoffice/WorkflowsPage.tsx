import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  Row,
  Select,
  Switch,
  Tooltip,
  Typography,
} from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { WorkflowDefinition } from '../../api/admin-types';
import { MoneyInput } from '../../components/admin/MoneyInput';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { formatDateTime } from '../../utils/format';
import { P } from '../../utils/permissions';
import '../../styles/admin.css';

const PATH = '/backoffice/workflows';
const MAX_STEPS = 5;

/** Approval permissions a workflow step can require (bo.approve.*). */
const APPROVER_OPTIONS = [
  { value: P.boApproveAgents, label: 'Agent approver' },
  { value: P.boApproveParticipants, label: 'Participant approver' },
  { value: P.boApprovePolicies, label: 'Underwriting approver' },
  { value: P.boApproveServicing, label: 'Servicing approver' },
  { value: P.boApprovePayments, label: 'Payment approver' },
];

interface StepValues {
  name: string;
  permission: string;
  minAmount?: number | null;
}

interface WorkflowValues {
  active: boolean;
  steps: StepValues[];
}

function WorkflowCard({ workflow }: { workflow: WorkflowDefinition }) {
  const [form] = Form.useForm<WorkflowValues>();
  const [dirty, setDirty] = useState(false);
  const save = useApiMutation(
    (values: WorkflowValues) =>
      api.put<WorkflowDefinition>(`${PATH}/${workflow.type}`, {
        active: values.active,
        steps: values.steps.map((step) => ({
          name: step.name.trim(),
          permission: step.permission,
          minAmount: step.minAmount ?? undefined,
        })),
      }),
    { success: `${workflow.name} saved`, invalidate: [PATH], onSuccess: () => setDirty(false) },
  );
  const initialValues: WorkflowValues = {
    active: workflow.active,
    steps: workflow.steps.map((step) => ({
      name: step.name,
      permission: step.permission,
      minAmount: step.minAmount === null ? null : Number(step.minAmount),
    })),
  };

  return (
    <Card
      className="content-card"
      title={workflow.name}
      extra={<span className="muted">Updated {formatDateTime(workflow.updatedAt)}</span>}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={initialValues}
        onValuesChange={() => setDirty(true)}
        onFinish={(values) => save.mutate(values)}
      >
        <Flex justify="space-between" align="center" gap={16} wrap className="mb-16">
          <Typography.Text type="secondary">{workflow.description}</Typography.Text>
          <Flex gap={8} align="center">
            <Form.Item name="active" valuePropName="checked" noStyle>
              <Switch id={`active-${workflow.type}`} />
            </Form.Item>
            <label htmlFor={`active-${workflow.type}`}>Approval required</label>
          </Flex>
        </Flex>
        <ErrorAlert error={save.error} className="mb-16" />
        <Form.List name="steps">
          {(fields, { add, remove, move }) => (
            <>
              {fields.length === 0 && (
                <Alert
                  className="mb-16"
                  type="warning"
                  showIcon
                  title="No approval steps: requests of this type are approved automatically."
                />
              )}
              {fields.map((field, index) => (
                <Row key={field.key} gutter={12} align="top">
                  <Col
                    xs={24}
                    md={1}
                    className={
                      index === 0 ? 'workflow-level workflow-level--first' : 'workflow-level'
                    }
                  >
                    {index + 1}
                  </Col>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name={[field.name, 'name']}
                      label={index === 0 ? 'Step name' : undefined}
                      rules={[
                        { required: true, whitespace: true, message: 'Name the step' },
                        { min: 2, max: 100 },
                      ]}
                    >
                      <Input aria-label={`Step ${index + 1} name`} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={7}>
                    <Form.Item
                      name={[field.name, 'permission']}
                      label={index === 0 ? 'Approved by' : undefined}
                      rules={[{ required: true, message: 'Choose the approver' }]}
                    >
                      <Select
                        aria-label={`Step ${index + 1} approver`}
                        options={APPROVER_OPTIONS}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item
                      name={[field.name, 'minAmount']}
                      label={index === 0 ? 'Applies from amount' : undefined}
                    >
                      <MoneyInput
                        aria-label={`Step ${index + 1} minimum amount`}
                        placeholder="Any amount"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={3}>
                    <Flex
                      gap={2}
                      className={index === 0 ? 'workflow-step-actions--first' : undefined}
                    >
                      <Tooltip title="Move up">
                        <Button
                          type="text"
                          icon={<ArrowUpOutlined />}
                          aria-label="Move step up"
                          disabled={index === 0}
                          onClick={() => move(index, index - 1)}
                        />
                      </Tooltip>
                      <Tooltip title="Move down">
                        <Button
                          type="text"
                          icon={<ArrowDownOutlined />}
                          aria-label="Move step down"
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                        />
                      </Tooltip>
                      <Tooltip title="Remove step">
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          aria-label="Remove step"
                          onClick={() => remove(field.name)}
                        />
                      </Tooltip>
                    </Flex>
                  </Col>
                </Row>
              ))}
              <Flex justify="space-between" gap={8} wrap>
                <Button
                  icon={<PlusOutlined />}
                  disabled={fields.length >= MAX_STEPS}
                  onClick={() => add({ name: '', permission: undefined, minAmount: null })}
                >
                  Add step
                </Button>
                <Flex gap={8}>
                  <Button
                    disabled={!dirty}
                    onClick={() => {
                      form.resetFields();
                      setDirty(false);
                    }}
                  >
                    Discard changes
                  </Button>
                  <Button
                    type="primary"
                    htmlType="submit"
                    disabled={!dirty}
                    loading={save.isPending}
                  >
                    Save
                  </Button>
                </Flex>
              </Flex>
            </>
          )}
        </Form.List>
      </Form>
    </Card>
  );
}

/** COM-04: approval levels, approving role and amount thresholds per transaction type. */
export default function WorkflowsPage() {
  const workflows = useApiQuery<WorkflowDefinition[]>(PATH);
  return (
    <>
      <PageHeader
        title="Workflows"
        subtitle="Approval levels for each type of request. A step with an amount applies only to requests at or above it; when no step applies the request is approved automatically."
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Workflows' }]}
      />
      <QueryState query={workflows}>
        {(items) => items.map((workflow) => <WorkflowCard key={workflow.id} workflow={workflow} />)}
      </QueryState>
    </>
  );
}
