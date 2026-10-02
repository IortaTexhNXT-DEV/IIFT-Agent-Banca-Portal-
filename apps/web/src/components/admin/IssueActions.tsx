import { App, Button, Form, Input, Modal, Popconfirm, Select } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Assignee } from '../../api/admin-types';
import type { Issue, IssuePriority, IssueStatus } from '../../api/types';
import { humanise } from '../../utils/format';
import { ActionBar } from '../ActionBar';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { ISSUE_PRIORITIES } from './issues';
import { enumOptions } from './useCodes';
import '../../styles/admin.css';

const INVALIDATE = ['/common/issues', '/backoffice/dashboard'];

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
    <ActionBar>
      <Popconfirm
        title="Reopen this issue?"
        okText="Reopen"
        onConfirm={() => change.mutate({ status: 'IN_PROGRESS' })}
      >
        <Button loading={pending('IN_PROGRESS')}>Reopen</Button>
      </Popconfirm>
      <Popconfirm
        title="Close this issue?"
        okText="Close issue"
        onConfirm={() => change.mutate({ status: 'CLOSED' })}
      >
        <Button type="primary" loading={pending('CLOSED')}>
          Confirm and close
        </Button>
      </Popconfirm>
    </ActionBar>
  );
}

type Dialog = 'assign' | 'priority' | 'note' | 'resolve';

interface AssignmentValues {
  assigneeId: string;
  team?: string;
}

/** BO-29/30: assign the issue to a support user; the SLA clock keeps running. */
function AssignModal({ issue, onClose }: { issue: Issue; onClose(): void }) {
  const [form] = Form.useForm<AssignmentValues>();
  const assignees = useApiQuery<Assignee[]>('/backoffice/issues/assignees');
  const assign = useApiMutation(
    (values: AssignmentValues) =>
      api.put<Issue>(`/backoffice/issues/${issue.id}/assignment`, {
        assigneeId: values.assigneeId,
        team: values.team?.trim() || undefined,
      }),
    { success: 'Issue assigned', invalidate: INVALIDATE, onSuccess: onClose },
  );
  return (
    <Modal
      open
      title={`Assign ${issue.issueNo}`}
      okText={issue.assignedToId ? 'Reassign' : 'Assign'}
      okButtonProps={{ loading: assign.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={480}
    >
      <ErrorAlert error={assign.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          assigneeId: issue.assignedToId ?? undefined,
          team: issue.assignedTeam ?? '',
        }}
        onFinish={(values) => assign.mutate(values)}
      >
        <FormSection columns={1}>
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
            <Input placeholder="Application support" />
          </Form.Item>
        </FormSection>
      </Form>
    </Modal>
  );
}

/** BO-30: re-prioritise the issue, which recalculates the response and resolution targets. */
function PriorityModal({ issue, onClose }: { issue: Issue; onClose(): void }) {
  const [form] = Form.useForm<{ priority: IssuePriority }>();
  const priority = Form.useWatch('priority', form) ?? issue.priority;
  const prioritise = useApiMutation(
    (value: IssuePriority) =>
      api.put<Issue>(`/backoffice/issues/${issue.id}/priority`, { priority: value }),
    { success: 'Priority changed', invalidate: INVALIDATE, onSuccess: onClose },
  );
  return (
    <Modal
      open
      title={`Priority of ${issue.issueNo}`}
      okText="Change priority"
      okButtonProps={{ loading: prioritise.isPending, disabled: priority === issue.priority }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={400}
    >
      <ErrorAlert error={prioritise.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{ priority: issue.priority }}
        onFinish={(values) => prioritise.mutate(values.priority)}
      >
        <Form.Item
          name="priority"
          label="Priority"
          tooltip="Response and resolution targets are recalculated"
        >
          <Select options={enumOptions(ISSUE_PRIORITIES, humanise)} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** BO-29: an internal note on the issue, hidden from the reporter. */
function NoteModal({ issue, onClose }: { issue: Issue; onClose(): void }) {
  const [form] = Form.useForm<{ body: string }>();
  const add = useApiMutation(
    (values: { body: string }) =>
      api.post(`/common/issues/${issue.id}/comments`, { body: values.body.trim(), internal: true }),
    { success: 'Note added', invalidate: ['/common/issues'], onSuccess: onClose },
  );
  return (
    <Modal
      open
      title={`Internal note on ${issue.issueNo}`}
      okText="Add note"
      okButtonProps={{ loading: add.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={520}
    >
      <ErrorAlert error={add.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={(values) => add.mutate(values)}
      >
        <Form.Item
          name="body"
          label="Note"
          tooltip="Not visible to the reporter"
          rules={[{ required: true, whitespace: true, message: 'Write the note' }, { max: 4000 }]}
        >
          <Input.TextArea rows={4} maxLength={4000} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** BO-29: resolving an issue needs a resolution, which is sent to the reporter. */
function ResolveModal({ issue, onClose }: { issue: Issue; onClose(): void }) {
  const [form] = Form.useForm<{ resolution: string }>();
  const change = useStatusChange(issue.id, { onSuccess: onClose });
  return (
    <Modal
      open
      title={`Resolve ${issue.issueNo}`}
      okText="Resolve"
      okButtonProps={{ loading: change.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={520}
    >
      <ErrorAlert error={change.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={(values) =>
          change.mutate({ status: 'RESOLVED', resolution: values.resolution.trim() })
        }
      >
        <Form.Item
          name="resolution"
          label="Resolution"
          tooltip="Sent to the reporter"
          rules={[
            { required: true, whitespace: true, message: 'Describe the resolution' },
            { max: 2000 },
          ]}
        >
          <Input.TextArea rows={4} maxLength={2000} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** BO-29..31: support actions on an issue – assign, prioritise, note, start, resolve, close. */
export function IssueActions({ issue }: { issue: Issue }) {
  const { message } = App.useApp();
  const [dialog, setDialog] = useState<Dialog>();
  const change = useStatusChange(issue.id, { onError: (error) => message.error(error.message) });
  const pending = (status: IssueStatus) => change.isPending && change.variables?.status === status;
  const closed = issue.status === 'CLOSED';
  if (closed) return null;
  const resolved = issue.status === 'RESOLVED';
  const open = !resolved;

  return (
    <>
      <ActionBar
        start={
          <Button onClick={() => setDialog('priority')} disabled={resolved}>
            Priority
          </Button>
        }
      >
        <Button onClick={() => setDialog('assign')}>
          {issue.assignedToId ? 'Reassign' : 'Assign'}
        </Button>
        <Button onClick={() => setDialog('note')}>Add note</Button>
        {open && issue.status !== 'IN_PROGRESS' && (
          <Button
            loading={pending('IN_PROGRESS')}
            onClick={() => change.mutate({ status: 'IN_PROGRESS' })}
          >
            Start work
          </Button>
        )}
        {open && (
          <Button type="primary" onClick={() => setDialog('resolve')}>
            Resolve
          </Button>
        )}
        {resolved && (
          <Popconfirm
            title="Close this issue?"
            okText="Close issue"
            onConfirm={() => change.mutate({ status: 'CLOSED' })}
          >
            <Button type="primary" loading={pending('CLOSED')}>
              Close
            </Button>
          </Popconfirm>
        )}
      </ActionBar>
      {dialog === 'assign' && <AssignModal issue={issue} onClose={() => setDialog(undefined)} />}
      {dialog === 'priority' && (
        <PriorityModal issue={issue} onClose={() => setDialog(undefined)} />
      )}
      {dialog === 'note' && <NoteModal issue={issue} onClose={() => setDialog(undefined)} />}
      {dialog === 'resolve' && <ResolveModal issue={issue} onClose={() => setDialog(undefined)} />}
    </>
  );
}
