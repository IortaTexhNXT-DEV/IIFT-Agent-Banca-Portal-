import { App, Button, Form, Input, Modal, Popconfirm, Select } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Assignee } from '../../api/admin-types';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { humanise } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { ISSUE_PRIORITIES } from './issues';
import { enumOptions } from './useCodes';
import '../../styles/admin.css';

const INVALIDATE = ['/common/issues', '/backoffice/dashboard'];
/** Statuses support staff move an issue to; "Assigned" follows from the assignment itself. */
const MANAGER_STATUSES: IssueStatus[] = ['IN_PROGRESS', 'RESOLVED', 'CLOSED'];

interface StatusChange {
  status: IssueStatus;
  resolution?: string;
}

function useStatusChange(
  issueId: string,
  options: { onSuccess?: () => void; onError?: (error: Error) => void } = {},
) {
  return useApiMutation(
    (body: StatusChange) => api.put<Issue>(`/common/issues/${issueId}/status`, body),
    {
      success: 'Issue status updated',
      invalidate: INVALIDATE,
      ...options,
    },
  );
}

/** Reporters confirm a resolution (close) or reopen the issue (AP-56). */
export function ReporterActions({ issue }: { issue: Issue }) {
  const { message } = App.useApp();
  const change = useStatusChange(issue.id, { onError: (error) => message.error(error.message) });
  const pending = (status: IssueStatus) => change.isPending && change.variables?.status === status;
  if (issue.status !== 'RESOLVED') return null;
  return (
    <>
      <Popconfirm
        title="Reopen this issue?"
        description="Support will continue working on it."
        okText="Reopen"
        onConfirm={() => change.mutate({ status: 'IN_PROGRESS' })}
      >
        <Button loading={pending('IN_PROGRESS')}>Reopen</Button>
      </Popconfirm>
      <Popconfirm
        title="Confirm the issue is resolved and close it?"
        okText="Close issue"
        onConfirm={() => change.mutate({ status: 'CLOSED' })}
      >
        <Button type="primary" loading={pending('CLOSED')}>
          Confirm and close
        </Button>
      </Popconfirm>
    </>
  );
}

/** BO-29: support staff move the issue through its life cycle; resolving needs a resolution. */
export function StatusChangeButton({ issue }: { issue: Issue }) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<StatusChange>();
  const status = Form.useWatch('status', form);
  const change = useStatusChange(issue.id, { onSuccess: () => setOpen(false) });
  const options = enumOptions(
    MANAGER_STATUSES.filter((value) => value !== issue.status),
    humanise,
  );

  return (
    <>
      <Button type="primary" onClick={() => setOpen(true)}>
        Change status
      </Button>
      <Modal
        open={open}
        title={`Change status of ${issue.issueNo}`}
        okText="Update status"
        okButtonProps={{ loading: change.isPending }}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <ErrorAlert error={change.error} className="mb-16" />
        <Form
          form={form}
          onFinish={(values) =>
            change.mutate({
              status: values.status,
              resolution: values.resolution?.trim() || undefined,
            })
          }
          layout="vertical"
          requiredMark="optional"
          preserve={false}
        >
          <Form.Item
            name="status"
            label="New status"
            rules={[{ required: true, message: 'Choose the new status' }]}
          >
            <Select options={options} />
          </Form.Item>
          {status === 'RESOLVED' && (
            <Form.Item
              name="resolution"
              label="Resolution"
              extra="Sent to the reporter"
              rules={[
                { required: true, whitespace: true, message: 'Describe the resolution' },
                { max: 2000 },
              ]}
            >
              <Input.TextArea rows={4} maxLength={2000} showCount />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}

interface AssignmentValues {
  assigneeId: string;
  team?: string;
}

/** BO-29/30: assign the issue to a support user and re-prioritise it (recalculates the SLA). */
export function IssueManagement({ issue }: { issue: Issue }) {
  const [form] = Form.useForm<AssignmentValues>();
  const assignees = useApiQuery<Assignee[]>('/backoffice/issues/assignees');
  const assign = useApiMutation(
    (values: AssignmentValues) =>
      api.put<Issue>(`/backoffice/issues/${issue.id}/assignment`, {
        assigneeId: values.assigneeId,
        team: values.team?.trim() || undefined,
      }),
    {
      success: 'Issue assigned',
      invalidate: INVALIDATE,
    },
  );
  const prioritise = useApiMutation(
    (priority: IssuePriority) =>
      api.put<Issue>(`/backoffice/issues/${issue.id}/priority`, { priority }),
    {
      success: 'Priority changed and SLA targets recalculated',
      invalidate: INVALIDATE,
    },
  );
  const [priority, setPriority] = useState<IssuePriority>(issue.priority);

  return (
    <>
      <ErrorAlert error={assign.error ?? prioritise.error} className="mb-16" />
      <Form
        form={form}
        name="issue-assignment"
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          assigneeId: issue.assignedToId ?? undefined,
          team: issue.assignedTeam ?? '',
        }}
        onFinish={(values) => assign.mutate(values)}
      >
        <Form.Item
          name="assigneeId"
          label="Assigned to"
          rules={[{ required: true, message: 'Choose a support user' }]}
        >
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            loading={assignees.isLoading}
            options={(assignees.data ?? []).map((assignee) => ({
              value: assignee.id,
              label: `${assignee.fullName} (${assignee.username})`,
            }))}
          />
        </Form.Item>
        <Form.Item name="team" label="Team" rules={[{ max: 50 }]}>
          <Input placeholder="e.g. Application support" />
        </Form.Item>
        <Button htmlType="submit" loading={assign.isPending} block>
          {issue.assignedToId ? 'Reassign' : 'Assign'}
        </Button>
      </Form>
      <Form name="issue-priority" layout="vertical" className="manage-priority">
        <Form.Item
          label="Priority"
          extra="Changing the priority recalculates the response and resolution targets"
        >
          <Select
            value={priority}
            options={enumOptions(ISSUE_PRIORITIES, humanise)}
            onChange={setPriority}
          />
        </Form.Item>
        <Popconfirm
          title={`Change priority to ${humanise(priority).toLowerCase()}?`}
          okText="Change"
          disabled={priority === issue.priority}
          onConfirm={() => prioritise.mutate(priority)}
        >
          <Button block disabled={priority === issue.priority} loading={prioritise.isPending}>
            Change priority
          </Button>
        </Popconfirm>
      </Form>
    </>
  );
}
