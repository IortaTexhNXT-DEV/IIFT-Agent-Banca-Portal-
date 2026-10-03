import { CheckCircleFilled, MinusCircleOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Spin } from 'antd';
import { Navigate, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { AuthResponse } from '../../api/types';
import { ActionBar } from '../../components/ActionBar';
import { AuthLayout } from '../../components/AuthLayout';
import { ErrorAlert } from '../../components/ErrorAlert';
import { homePath, useAuth } from '../../auth/AuthContext';

interface Values {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const RULES: { label: string; test(value: string): boolean }[] = [
  { label: 'At least 12 characters', test: (value) => value.length >= 12 },
  {
    label: 'Upper- and lower-case letters',
    test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
  {
    label: 'A digit and a symbol',
    test: (value) => /\d/.test(value) && /[^A-Za-z0-9]/.test(value),
  },
];

/** Live checklist of the password policy; the last 5 passwords are rejected by the server. */
function PasswordRules({ value }: { value: string }) {
  return (
    <ul className="password-rules" aria-label="Password rules">
      {RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.label} className={met ? 'password-rules__met' : undefined}>
            {met ? <CheckCircleFilled /> : <MinusCircleOutlined />}
            {rule.label}
          </li>
        );
      })}
      <li>
        <MinusCircleOutlined />
        Not one of your last 5 passwords
      </li>
    </ul>
  );
}

/** AP-02: change password. Also the forced step after a temporary or expired password. */
export default function ChangePasswordPage() {
  const { user, loading, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm<Values>();
  const newPassword = Form.useWatch('newPassword', form) ?? '';
  const change = useApiMutation(
    (values: Values) =>
      api.post<AuthResponse>('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    {
      success: 'Password changed',
      onSuccess: (response) => {
        refresh(response);
        navigate(homePath(response.user), { replace: true });
      },
    },
  );

  // The session is still being read for a moment right after sign-in; only an absent
  // session sends the user back to the sign-in page.
  if (loading) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <AuthLayout title="Change password">
      {user.mustChangePassword && (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title="Temporary or expired password. Set a new one to continue."
        />
      )}
      <ErrorAlert error={change.error} className="mb-16" />
      <Form<Values>
        form={form}
        layout="vertical"
        onFinish={(values) => change.mutate(values)}
        requiredMark={false}
      >
        <Form.Item
          name="currentPassword"
          label="Current password"
          rules={[{ required: true, message: 'Enter your current password' }]}
        >
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label="New password"
          rules={[{ required: true, min: 12, message: 'At least 12 characters' }]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <PasswordRules value={newPassword} />
        <Form.Item
          name="confirmPassword"
          label="Confirm new password"
          dependencies={['newPassword']}
          rules={[
            { required: true, message: 'Confirm the new password' },
            ({ getFieldValue }) => ({
              validator: (_, value) =>
                value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Passwords do not match')),
            }),
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <ActionBar>
          {user.mustChangePassword ? (
            <Button onClick={() => void logout().then(() => navigate('/login'))}>Sign out</Button>
          ) : (
            <Button onClick={() => navigate(-1)}>Cancel</Button>
          )}
          <Button type="primary" htmlType="submit" loading={change.isPending}>
            Change password
          </Button>
        </ActionBar>
      </Form>
    </AuthLayout>
  );
}
