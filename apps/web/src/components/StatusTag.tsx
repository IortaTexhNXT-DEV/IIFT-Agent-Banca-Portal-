import { Tag } from 'antd';
import { humanise } from '../utils/format';
import { statusColour } from '../utils/status';

export function StatusTag({ status, label }: { status: string | null | undefined; label?: string }) {
  if (!status) return null;
  return (
    <Tag color={statusColour(status)} variant="filled" className="status-tag">
      {label ?? humanise(status)}
    </Tag>
  );
}
