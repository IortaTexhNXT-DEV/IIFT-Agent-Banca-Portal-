import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { ErrorAlert } from '../../components/ErrorAlert';
import { homePath, useAuth } from '../../auth/AuthContext';

interface Credentials {
  username: string;
  password: string;
}

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
      navigate(signedIn.mustChangePassword ? '/change-password' : homePath(signedIn), { replace: true });
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <section className="auth-page__visual" aria-hidden="true">
        <div className="auth-page__product">SalesVerse 2.0</div>
        <div>
          <h1>Agent & Banca Portal and Back-office</h1>
          <p>Quotation, issuance, payments, claims notification and servicing for Insurans Islam Family Takaful products, with approvals and records handled in one system.</p>
        </div>
        <p>Insurans Islam Family Takaful Sendirian Berhad · A member of Insurans Islam TAIB Holding</p>
      </section>

      <section className="auth-page__form">
        <img src="/iift-logo.png" alt="Insurans Islam Family Takaful" className="auth-page__logo" />
        <Typography.Title level={3}>Sign in</Typography.Title>
        <Typography.Paragraph type="secondary">Use the username and password issued to you by IIFT.</Typography.Paragraph>

        {sessionEnded && <Alert className="mb-16" type="info" showIcon title="Your session ended. Please sign in again." />}
        <ErrorAlert error={error} className="mb-16" />

        <Form<Credentials> layout="vertical" onFinish={submit} requiredMark={false} size="large">
          <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Enter your username' }]}>
            <Input prefix={<UserOutlined />} autoComplete="username" autoFocus />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Enter your password' }]}>
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={submitting}>
            Sign in
          </Button>
        </Form>

        <p className="auth-page__notice">
          For authorised agents, bank officers and IIFT staff only. Sign-in attempts and activity are recorded. Accounts are locked after repeated failed attempts; contact the IIFT
          support desk to unlock.
        </p>
      </section>
    </div>
  );
}
