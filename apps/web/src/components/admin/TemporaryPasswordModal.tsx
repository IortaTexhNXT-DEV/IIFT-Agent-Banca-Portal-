import { Alert, Modal, Typography } from 'antd';
import '../../styles/admin.css';

interface Props {
  username: string;
  password: string;
  onClose(): void;
}

/** Shows a one-time temporary password; it cannot be displayed again once closed. */
export function TemporaryPasswordModal({ username, password, onClose }: Props) {
  return (
    <Modal open title="Temporary password" okText="Done" onOk={onClose} onCancel={onClose} cancelButtonProps={{ hidden: true }} destroyOnHidden>
      <Alert
        className="mb-16"
        type="warning"
        showIcon
        title="This password is shown only once"
        description={`Give it to ${username} through a secure channel. They must change it at first sign-in.`}
      />
      <div className="muted">Temporary password for {username}</div>
      <Typography.Text code copyable={{ tooltips: ['Copy', 'Copied'] }} className="temp-password">
        {password}
      </Typography.Text>
    </Modal>
  );
}
