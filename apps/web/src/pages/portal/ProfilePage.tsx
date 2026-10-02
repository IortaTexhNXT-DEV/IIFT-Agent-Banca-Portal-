import { EditOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { AgentDetail, ApprovalRequest } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { AgentDocuments } from '../../components/admin/AgentDocuments';
import { mobileRule } from '../../components/admin/AgentFormFields';
import { AgentProfile } from '../../components/admin/AgentProfile';
import { ApprovalHistory } from '../../components/ApprovalHistory';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { formatDateTime } from '../../utils/format';
import { P } from '../../utils/permissions';

type ContactField = 'email' | 'mobile' | 'address' | 'branchName';
type ContactValues = Partial<Record<ContactField, string>>;

const CONTACT_FIELDS: ContactField[] = ['email', 'mobile', 'address', 'branchName'];

/** Only fields that differ from the current profile are sent for approval. */
function changedFields(profile: AgentDetail, values: ContactValues): ContactValues {
  return Object.fromEntries(
    CONTACT_FIELDS.map((field) => [field, values[field]?.trim() ?? ''] as const).filter(
      ([field, value]) => value !== '' && value !== (profile[field] ?? ''),
    ),
  );
}

function UpdateRequestModal({ profile, onClose }: { profile: AgentDetail; onClose(): void }) {
  const [form] = Form.useForm<ContactValues>();
  const [unchanged, setUnchanged] = useState(false);
  const request = useApiMutation(
    (changes: ContactValues) =>
      api.post<ApprovalRequest>('/portal/profile/update-requests', changes),
    {
      invalidate: ['/portal/profile', '/portal/requests'],
      onSuccess: onClose,
      success: 'Update request submitted for approval',
    },
  );

  const submit = (values: ContactValues) => {
    const changes = changedFields(profile, values);
    setUnchanged(Object.keys(changes).length === 0);
    if (Object.keys(changes).length > 0) request.mutate(changes);
  };

  return (
    <Modal
      open
      title="Request profile update"
      okText="Submit for approval"
      okButtonProps={{ loading: request.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <Alert
        className="mb-16"
        type="info"
        showIcon
        title="Changes take effect once IIFT approves the request."
      />
      {unchanged && (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title="Change at least one field before submitting."
        />
      )}
      <ErrorAlert error={request.error} className="mb-16" />
      <Form
        form={form}
        onFinish={submit}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          email: profile.email,
          mobile: profile.mobile,
          address: profile.address ?? '',
          branchName: profile.branchName ?? '',
        }}
      >
        <Form.Item
          name="email"
          label="Email"
          rules={[{ type: 'email', message: 'Enter a valid email address' }, { max: 254 }]}
        >
          <Input type="email" />
        </Form.Item>
        <Form.Item name="mobile" label="Mobile" rules={[mobileRule]}>
          <Input inputMode="tel" />
        </Form.Item>
        <Form.Item name="address" label="Address" rules={[{ max: 300 }]}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="branchName" label="Branch" rules={[{ max: 100 }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** AP-05/06/47: own profile, documents with validity, and profile update requests. */
export default function ProfilePage() {
  const { can } = useAuth();
  const profile = useApiQuery<AgentDetail>('/portal/profile');
  const [editing, setEditing] = useState(false);

  return (
    <QueryState query={profile}>
      {(data) => {
        const pendingUpdate = data.approvals.find(
          (approval) => approval.type === 'AGENT_PROFILE_UPDATE' && approval.status === 'PENDING',
        );
        return (
          <>
            <PageHeader
              title="My profile"
              subtitle={`${data.fullName} · ${data.agentCode}`}
              breadcrumb={[{ title: 'Dashboard', to: '/portal' }, { title: 'My profile' }]}
              extra={
                can(P.portalProfileUpdate) && (
                  <Button
                    icon={<EditOutlined />}
                    disabled={Boolean(pendingUpdate)}
                    onClick={() => setEditing(true)}
                  >
                    Request profile update
                  </Button>
                )
              }
            />
            {pendingUpdate && (
              <Alert
                className="mb-16"
                type="info"
                showIcon
                title={
                  <>
                    Update request{' '}
                    <Link to={`/portal/requests/${pendingUpdate.id}`}>
                      {pendingUpdate.requestNo}
                    </Link>{' '}
                    is awaiting IIFT approval.
                  </>
                }
              />
            )}
            <Card title="Profile" className="content-card">
              <AgentProfile
                agent={data}
                extra={[
                  {
                    key: 'username',
                    label: 'Portal user name',
                    children: data.user?.username ?? '–',
                  },
                  {
                    key: 'lastLogin',
                    label: 'Last sign-in',
                    children: formatDateTime(data.user?.lastLoginAt),
                  },
                ]}
              />
            </Card>
            <Card className="content-card">
              <AgentDocuments
                agentId={data.id}
                idType={data.idType}
                channel={data.agency.channel}
                canUpload={can(P.portalProfileUpdate)}
                title="My documents"
              />
            </Card>
            <Card title="Change requests" className="content-card">
              <ApprovalHistory approvals={data.approvals} />
            </Card>
            {editing && <UpdateRequestModal profile={data} onClose={() => setEditing(false)} />}
          </>
        );
      }}
    </QueryState>
  );
}
