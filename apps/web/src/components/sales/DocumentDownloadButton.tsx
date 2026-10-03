import { DownloadOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { useState } from 'react';
import { ApiError, download } from '../../api/client';
import { useNotify } from '../notify';

/** Downloads a stored document (e-Receipt, schedule, proof) by its id. */
export function DocumentDownloadButton({
  documentId,
  label,
}: {
  documentId: string;
  label: string;
}) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      await download(`/common/documents/${documentId}/content`);
    } catch (error) {
      notify.error({
        title: 'Download failed',
        description: error instanceof ApiError ? error.message : 'The document is not available',
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Tooltip title="Download">
      <Button
        type="text"
        icon={<DownloadOutlined />}
        loading={busy}
        aria-label={`Download ${label}`}
        onClick={() => void start()}
      />
    </Tooltip>
  );
}
