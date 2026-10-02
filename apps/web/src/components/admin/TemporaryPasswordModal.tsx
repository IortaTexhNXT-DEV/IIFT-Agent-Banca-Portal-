import { Alert, Button, Modal, Typography } from 'antd';
import { FieldGrid } from '../FieldGrid';
import '../../styles/admin.css';

interface Props {
  username: string;
  password: string;
  onClose(): void;
}

/** Shows a one-time temporary password; it cannot be displayed again once closed. */
export function TemporaryPasswordModal({ username, password, onClose }: Props) {
  return (
    <Modal
      open
      title="Temporary password"
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          Done
        </Button>
      }
      destroyOnHidden
      width={420}
    >
      <Alert
        className="mb-16"
        type="warning"
        showIcon
        title="Shown once – the user must change it at first sign-in"
      />
      <FieldGrid
        columns={1}
        items={[
          { key: 'user', label: 'User', value: username },
          {
            key: 'password',
            label: 'Temporary password',
            value: (
              <Typography.Text
                code
                copyable={{ tooltips: ['Copy', 'Copied'] }}
                className="temp-password"
              >
                {password}
              </Typography.Text>
            ),
          },
        ]}
      />
    </Modal>
  );
}
