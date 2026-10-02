import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AuthLayout } from '../../components/AuthLayout';
import { ErrorAlert } from '../../components/ErrorAlert';
import { homePath, useAuth } from '../../auth/AuthContext';

interface Credentials {
  username: string;
  password: string;
}

/** AP-01: sign-in for portal users and IIFT staff. */
export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<unknown>();
  const [submitting, setSubmitting] = useState(false);
  const sessionEnded = new URLSearchParams(location.search).get('expired') === '1';

  if (user) {
    return <Navigate to={user.mustChangePassword ? '/change-password' : homePath(user)} replace />;
  }

  const submit = async ({ username, password }: Credentials) => {
    setSubmitting(true);
    setError(undefined);
    try {
      const signedIn = await login(username.trim(), password);
      navigate(signedIn.mustChangePassword ? '/change-password' : homePath(signedIn), {
        replace: true,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Sign in">
      {sessionEnded && (
        <Alert
          className="mb-16"
          type="info"
          showIcon
          title="Your session ended. Please sign in again."
        />
      )}
      <ErrorAlert error={error} className="mb-16" />
      <Form<Credentials> layout="vertical" onFinish={submit} requiredMark={false}>
        <Form.Item
          name="username"
          label="Username"
          rules={[{ required: true, message: 'Enter your username' }]}
        >
          <Input prefix={<UserOutlined className="muted" />} autoComplete="username" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: 'Enter your password' }]}
        >
          <Input.Password
            prefix={<LockOutlined className="muted" />}
            autoComplete="current-password"
          />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={submitting}>
          Sign in
        </Button>
      </Form>
      <p className="auth-card__notice">Authorised users only. Activity is recorded.</p>
    </AuthLayout>
  );
}
