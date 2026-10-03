import { Form, Input, Modal, Radio, Select } from 'antd';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { CreatedUser, RoleOption, UserSummary } from '../../api/admin-types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
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
      <ErrorAlert error={save.error} title="User not saved" className="mb-16" />
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
        {!user && (
          <FormSection title="Account" columns={2}>
            <Form.Item
              name="username"
              label="User name"
              rules={[
                { required: true, message: 'Enter the username' },
                {
                  pattern: USERNAME_PATTERN,
                  message: '3 to 64 letters, digits, dots, hyphens or underscores',
                },
              ]}
            >
              <Input autoComplete="off" />
            </Form.Item>
            <Form.Item name="authSource" label="Sign-in method" rules={[{ required: true }]}>
              <Radio.Group
                options={[
                  { value: 'LOCAL', label: 'Password' },
                  { value: 'DIRECTORY', label: 'Corporate directory' },
                ]}
              />
            </Form.Item>
          </FormSection>
        )}
        <FormSection title="Details" columns={2}>
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
          <Form.Item
            name="email"
            label="E-mail"
            rules={[
              { required: true, message: 'Enter the e-mail address' },
              { type: 'email', message: 'Enter a valid e-mail address' },
            ]}
          >
            <Input type="email" />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile" rules={[mobileRule]}>
            <Input inputMode="tel" />
          </Form.Item>
        </FormSection>
        <FormSection title="Access" columns={1}>
          <Form.Item
            name="roleIds"
            label="Roles"
            tooltip={self ? 'Your own roles are changed by another administrator' : undefined}
            rules={[{ required: true, type: 'array', min: 1, message: 'Assign at least one role' }]}
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
        </FormSection>
      </Form>
    </Modal>
  );
}
