import { DownloadOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import { download } from '../../api/client';

/** Icon button that downloads a stored document (or generated file) by id. */
export function DocumentDownloadButton({ documentId, fileName }: { documentId: string; fileName: string }) {
  return (
    <Tooltip title="Download">
      <Button type="text" icon={<DownloadOutlined />} aria-label={`Download ${fileName}`} onClick={() => void download(`/common/documents/${documentId}/content`)} />
    </Tooltip>
  );
}
