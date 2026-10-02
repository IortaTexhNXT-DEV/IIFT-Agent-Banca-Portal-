import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Alert, Button, Drawer, Form, Input, Select, Switch, Table, Tooltip } from 'antd';
import type { FormListFieldData } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { WorkflowDefinition } from '../../api/admin-types';
import { MoneyInput } from '../../components/admin/MoneyInput';
import { ActionBar } from '../../components/ActionBar';
import { DataTable, dateTimeColumn, textColumn } from '../../components/DataTable';
import { ErrorAlert } from '../../components/ErrorAlert';
import { FormSection } from '../../components/FormSection';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { TableCard } from '../../components/TableCard';
import { formatNumber } from '../../utils/format';
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

function toBody(values: WorkflowValues) {
  return {
    active: values.active,
    steps: values.steps.map((step) => ({
      name: step.name.trim(),
      permission: step.permission,
      minAmount: step.minAmount ?? undefined,
    })),
  };
}

function initialValues(workflow: WorkflowDefinition): WorkflowValues {
  return {
    active: workflow.active,
    steps: workflow.steps.map((step) => ({
      name: step.name,
      permission: step.permission,
      minAmount: step.minAmount === null ? null : Number(step.minAmount),
    })),
  };
}

/** COM-04: approval levels of one transaction type, edited as a small step table. */
function WorkflowDrawer({ workflow, onClose }: { workflow: WorkflowDefinition; onClose(): void }) {
  const [form] = Form.useForm<WorkflowValues>();
  const save = useApiMutation(
    (values: WorkflowValues) =>
      api.put<WorkflowDefinition>(`${PATH}/${workflow.type}`, toBody(values)),
    { success: `${workflow.name} saved`, invalidate: [PATH], onSuccess: onClose },
  );

  return (
    <Drawer
      open
      size={860}
      title={workflow.name}
      onClose={onClose}
      destroyOnHidden
      footer={
        <ActionBar>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            Save
          </Button>
        </ActionBar>
      }
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={initialValues(workflow)}
        onFinish={(values) => save.mutate(values)}
      >
        <FormSection title="Workflow" columns={2}>
          <Form.Item label="Description" required>
            <Input value={workflow.description ?? '–'} disabled />
          </Form.Item>
          <Form.Item
            name="active"
            label="Approval required"
            valuePropName="checked"
            required
            tooltip="When off, requests of this type are approved automatically"
          >
            <Switch />
          </Form.Item>
        </FormSection>
        <Form.List name="steps">
          {(fields, { add, remove, move }) => (
            <FormSection
              title="Approval steps"
              columns={1}
              extra={
                <Button
                  size="small"
                  icon={<PlusOutlined />}
                  disabled={fields.length >= MAX_STEPS}
                  onClick={() => add({ name: '', permission: undefined, minAmount: null })}
                >
                  Add step
                </Button>
              }
            >
              {fields.length === 0 && (
                <Alert
                  className="mb-16"
                  type="warning"
                  showIcon
                  title="No steps – requests are approved automatically"
                />
              )}
              <Table<FormListFieldData>
                className="step-table"
                size="small"
                rowKey="key"
                pagination={false}
                dataSource={fields}
                showHeader={fields.length > 0}
                locale={{ emptyText: 'No steps' }}
                columns={[
                  {
                    title: 'Level',
                    key: 'level',
                    width: 60,
                    render: (_: unknown, __: FormListFieldData, index) => (
                      <span className="step-table__level">{index + 1}</span>
                    ),
                  },
                  {
                    title: 'Step name',
                    key: 'name',
                    render: (_: unknown, field, index) => (
                      <Form.Item
                        name={[field.name, 'name']}
                        rules={[
                          { required: true, whitespace: true, message: 'Name the step' },
                          { min: 2, max: 100, message: '2 to 100 characters' },
                        ]}
                      >
                        <Input aria-label={`Step ${index + 1} name`} />
                      </Form.Item>
                    ),
                  },
                  {
                    title: 'Approved by',
                    key: 'permission',
                    width: 220,
                    render: (_: unknown, field, index) => (
                      <Form.Item
                        name={[field.name, 'permission']}
                        rules={[{ required: true, message: 'Choose the approver' }]}
                      >
                        <Select
                          aria-label={`Step ${index + 1} approver`}
                          options={APPROVER_OPTIONS}
                        />
                      </Form.Item>
                    ),
                  },
                  {
                    title: (
                      <Tooltip title="Step applies only to requests at or above this amount">
                        <span>From amount</span>
                      </Tooltip>
                    ),
                    key: 'minAmount',
                    width: 170,
                    render: (_: unknown, field, index) => (
                      <Form.Item name={[field.name, 'minAmount']}>
                        <MoneyInput
                          aria-label={`Step ${index + 1} minimum amount`}
                          placeholder="Any"
                        />
                      </Form.Item>
                    ),
                  },
                  {
                    key: 'actions',
                    width: 110,
                    align: 'right',
                    render: (_: unknown, field, index) => (
                      <span className="row-actions">
                        <Tooltip title="Move up">
                          <Button
                            type="text"
                            size="small"
                            icon={<ArrowUpOutlined />}
                            aria-label="Move step up"
                            disabled={index === 0}
                            onClick={() => move(index, index - 1)}
                          />
                        </Tooltip>
                        <Tooltip title="Move down">
                          <Button
                            type="text"
                            size="small"
                            icon={<ArrowDownOutlined />}
                            aria-label="Move step down"
                            disabled={index === fields.length - 1}
                            onClick={() => move(index, index + 1)}
                          />
                        </Tooltip>
                        <Tooltip title="Remove">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            aria-label="Remove step"
                            onClick={() => remove(field.name)}
                          />
                        </Tooltip>
                      </span>
                    ),
                  },
                ]}
              />
            </FormSection>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}

/** COM-04: approval levels, approving role and amount thresholds per transaction type. */
export default function WorkflowsPage() {
  const workflows = useApiQuery<WorkflowDefinition[]>(PATH);
  const [editing, setEditing] = useState<WorkflowDefinition>();
  const toggle = useApiMutation(
    ({ workflow, active }: { workflow: WorkflowDefinition; active: boolean }) =>
      api.put<WorkflowDefinition>(
        `${PATH}/${workflow.type}`,
        toBody({ ...initialValues(workflow), active }),
      ),
    { success: 'Workflow saved', invalidate: [PATH] },
  );

  return (
    <>
      <PageHeader
        title="Workflows"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Workflows' }]}
      />
      <ErrorAlert error={toggle.error} className="mb-16" />
      <QueryState query={workflows}>
        {(items) => (
          <TableCard>
            <DataTable<WorkflowDefinition>
              rowKey="id"
              scroll={{}}
              pagination={false}
              dataSource={items}
              locale={{ emptyText: 'No workflows' }}
              onRowClick={setEditing}
              columns={[
                { title: 'Workflow', dataIndex: 'name', width: 230 },
                textColumn('Description', 'description'),
                {
                  title: 'Levels',
                  dataIndex: 'steps',
                  width: 80,
                  align: 'right',
                  render: (steps: WorkflowDefinition['steps']) => formatNumber(steps.length),
                },
                {
                  title: 'Approvers',
                  key: 'approvers',
                  width: 260,
                  ellipsis: true,
                  render: (_: unknown, workflow) =>
                    workflow.steps.length === 0
                      ? '–'
                      : workflow.steps
                          .map(
                            (step) =>
                              APPROVER_OPTIONS.find((option) => option.value === step.permission)
                                ?.label ?? step.permission,
                          )
                          .join(' › '),
                },
                {
                  title: 'Approval required',
                  dataIndex: 'active',
                  width: 140,
                  render: (active: boolean, workflow) => (
                    <Switch
                      size="small"
                      checked={active}
                      aria-label={`Approval required for ${workflow.name}`}
                      loading={toggle.isPending && toggle.variables?.workflow.id === workflow.id}
                      onChange={(checked) => toggle.mutate({ workflow, active: checked })}
                    />
                  ),
                },
                dateTimeColumn('Updated', 'updatedAt', 150),
                {
                  key: 'actions',
                  width: 48,
                  align: 'right',
                  render: (_: unknown, workflow) => (
                    <Tooltip title="Edit steps">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={`Edit ${workflow.name}`}
                        onClick={() => setEditing(workflow)}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />
          </TableCard>
        )}
      </QueryState>
      {editing && <WorkflowDrawer workflow={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
