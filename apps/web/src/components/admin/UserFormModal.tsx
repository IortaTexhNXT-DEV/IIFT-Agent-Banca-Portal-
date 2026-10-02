import { Col, Form, Input, Modal, Radio, Row, Select } from 'antd';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { CreatedUser, RoleOption, UserSummary } from '../../api/admin-types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert } from '../ErrorAlert';
import { mobileRule, optional } from './AgentFormFields';

const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/i;

interface UserValues {
  username: string;
  fullName: string;
  email: string;
  mobile?: string;
  authSource: 'LOCAL' | 'DIRECTORY';
  roleIds: string[];
}

interface Props {
  /** User to edit; omit to create a staff user. */
  user?: UserSummary;
  onClose(): void;
  onCreated?(result: CreatedUser): void;
}

/** BO-03: create a back-office staff user or maintain any user's details and roles. */
export function UserFormModal({ user, onClose, onCreated }: Props) {
  const { user: me } = useAuth();
  const [form] = Form.useForm<UserValues>();
  const roles = useApiQuery<RoleOption[]>('/backoffice/role-options');
  const audience = !user || user.userType === 'STAFF' ? 'BACKOFFICE' : 'PORTAL';
  const self = user?.id === me?.id;

  const save = useApiMutation<UserValues, UserSummary | CreatedUser>(
    (values) => {
      const details = {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        mobile: optional(values.mobile),
      };
      return user
        ? api.patch<UserSummary>(`/backoffice/users/${user.id}`, {
            ...details,
            roleIds: self ? undefined : values.roleIds,
          })
        : api.post<CreatedUser>('/backoffice/users', {
            ...details,
            username: values.username.trim(),
            authSource: values.authSource,
            roleIds: values.roleIds,
          });
    },
    {
      success: user ? 'User saved' : 'User created',
      invalidate: ['/backoffice/users', '/backoffice/roles'],
      onSuccess: (result) => {
        if ('user' in result) onCreated?.(result);
        onClose();
      },
    },
  );

  return (
    <Modal
      open
      title={user ? `Edit ${user.username}` : 'New staff user'}
      okText={user ? 'Save' : 'Create user'}
      okButtonProps={{ loading: save.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
      width={640}
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => save.mutate(values)}
        layout="vertical"
        requiredMark="optional"
        initialValues={
          user
            ? {
                fullName: user.fullName,
                email: user.email,
                mobile: user.mobile ?? '',
                roleIds: user.roles.map(({ role }) => role.id),
              }
            : { authSource: 'LOCAL', roleIds: [] }
        }
      >
        <Row gutter={16}>
          {!user && (
            <>
              <Col xs={24} md={12}>
                <Form.Item
                  name="username"
                  label="User name"
                  rules={[
                    { required: true, message: 'Enter a user name' },
                    {
                      pattern: USERNAME_PATTERN,
                      message: '3 to 64 letters, digits, dots, hyphens or underscores',
                    },
                  ]}
                >
                  <Input autoComplete="off" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="authSource" label="Sign-in method" rules={[{ required: true }]}>
                  <Radio.Group
                    options={[
                      { value: 'LOCAL', label: 'Password' },
                      { value: 'DIRECTORY', label: 'Corporate directory' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </>
          )}
          <Col xs={24} md={12}>
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
          </Col>
          <Col xs={24} md={12}>
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
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="mobile" label="Mobile" rules={[mobileRule]}>
              <Input inputMode="tel" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              name="roleIds"
              label="Roles"
              extra={self ? 'You cannot change your own roles' : undefined}
              rules={[
                { required: true, type: 'array', min: 1, message: 'Assign at least one role' },
              ]}
            >
              <Select
                mode="multiple"
                disabled={self}
                loading={roles.isLoading}
                showSearch={{ optionFilterProp: 'label' }}
                options={(roles.data ?? [])
                  .filter((role) => role.audience === audience)
                  .map((role) => ({ value: role.id, label: role.name }))}
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
