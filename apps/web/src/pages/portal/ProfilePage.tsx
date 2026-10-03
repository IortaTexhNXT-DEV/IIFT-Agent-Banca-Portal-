import { EditOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Form, Input, Row, Tabs } from 'antd';
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
import { FieldGrid } from '../../components/FieldGrid';
import { FormSection } from '../../components/FormSection';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { FormModal } from '../../components/sales/FormModal';
import { StatusTag } from '../../components/StatusTag';
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
    <FormModal<ContactValues>
      title="Request profile update"
      okText="Submit for approval"
      form={form}
      width={640}
      initialValues={{
        email: profile.email,
        mobile: profile.mobile,
        address: profile.address ?? '',
        branchName: profile.branchName ?? '',
      }}
      onSubmit={submit}
      onClose={onClose}
      pending={request.isPending}
      error={request.error}
    >
      {unchanged && (
        <Alert className="mb-16" type="warning" showIcon title="Change at least one field" />
      )}
      <FormSection title="Contact details" columns={2}>
        <Form.Item
          name="email"
          label="E-mail"
          rules={[{ type: 'email', message: 'Enter a valid e-mail address' }, { max: 254 }]}
        >
          <Input type="email" />
        </Form.Item>
        <Form.Item name="mobile" label="Mobile" rules={[mobileRule]}>
          <Input inputMode="tel" />
        </Form.Item>
        <Form.Item name="branchName" label="Branch" rules={[{ max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="address" label="Address" rules={[{ max: 300 }]} className="field--full">
          <Input.TextArea rows={2} />
        </Form.Item>
      </FormSection>
    </FormModal>
  );
}

function count(label: string, total: number): string {
  return total > 0 ? `${label} (${total})` : label;
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
              tags={<StatusTag status={data.status} />}
              meta={[
                { label: 'Name', value: data.fullName },
                { label: 'Code', value: data.agentCode },
                {
                  label: data.agency.channel === 'BANCA' ? 'Bank' : 'Agency',
                  value: data.agency.name,
                },
              ]}
              breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'My profile' }]}
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
                title={`Update request ${pendingUpdate.requestNo} awaiting IIFT approval`}
                action={
                  <Link to={`/portal/requests/${pendingUpdate.id}`}>
                    <Button size="small">View request</Button>
                  </Link>
                }
              />
            )}
            <Row gutter={16}>
              <Col xs={24} xl={16}>
                <Card title="Profile" className="content-card">
                  <AgentProfile agent={data} />
                </Card>
              </Col>
              <Col xs={24} xl={8}>
                <Card title="Portal account" className="content-card">
                  <FieldGrid
                    columns={2}
                    items={[
                      { key: 'username', label: 'User name', value: data.user?.username },
                      {
                        key: 'userStatus',
                        label: 'Account status',
                        value: <StatusTag status={data.user?.status} />,
                      },
                      {
                        key: 'lastLogin',
                        label: 'Last sign-in',
                        value: formatDateTime(data.user?.lastLoginAt),
                        span: 2,
                      },
                    ]}
                  />
                </Card>
              </Col>
            </Row>
            <Tabs
              className="page-tabs"
              items={[
                {
                  key: 'documents',
                  label: count('Documents', data.documents.length),
                  children: (
                    <Card className="content-card">
                      <AgentDocuments
                        agentId={data.id}
                        idType={data.idType}
                        channel={data.agency.channel}
                        canUpload={can(P.portalProfileUpdate)}
                        title="My documents"
                      />
                    </Card>
                  ),
                },
                {
                  key: 'requests',
                  label: count('Change requests', data.approvals.length),
                  children: (
                    <Card className="content-card">
                      <ApprovalHistory approvals={data.approvals} />
                    </Card>
                  ),
                },
              ]}
            />
            {editing && <UpdateRequestModal profile={data} onClose={() => setEditing(false)} />}
          </>
        );
      }}
    </QueryState>
  );
}
