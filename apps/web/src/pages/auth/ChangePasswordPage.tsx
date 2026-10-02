import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { Navigate, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { AuthResponse } from '../../api/types';
import { ErrorAlert } from '../../components/ErrorAlert';
import { homePath, useAuth } from '../../auth/AuthContext';

interface Values {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** AP-02: change password. Also the forced step after a temporary or expired password. */
export default function ChangePasswordPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
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

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="public-page">
      <Card className="public-page__card">
        <img src="/iift-logo.png" alt="Insurans Islam Family Takaful" className="auth-page__logo" />
        <Typography.Title level={3}>Change password</Typography.Title>
        {user.mustChangePassword && (
          <Alert
            className="mb-16"
            type="warning"
            showIcon
            title="You must set a new password before continuing."
            description="Your password is temporary or has expired."
          />
        )}
        <Typography.Paragraph type="secondary">
          Use at least 12 characters with upper- and lower-case letters, a digit and a symbol. Your
          last 5 passwords cannot be reused.
        </Typography.Paragraph>
        <ErrorAlert error={change.error} className="mb-16" />
        <Form<Values>
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
          <Button type="primary" htmlType="submit" loading={change.isPending}>
            Change password
          </Button>{' '}
          {user.mustChangePassword ? (
            <Button type="link" onClick={() => void logout().then(() => navigate('/login'))}>
              Sign out
            </Button>
          ) : (
            <Button type="link" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          )}
        </Form>
      </Card>
    </div>
  );
}
