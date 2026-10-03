/**
 * StatusTag – the one status chip of the platform: fixed height (22px), fixed minimum width
 * so chips line up in table columns (96px; `wide` gives 120px for payment statuses), centred
 * text and one colour per semantic group (utils/status.ts).
 *
 *   <StatusTag status="PENDING_APPROVAL" />
 *   <StatusTag status="ACTIVE" label="In force" />
 *   <StatusTag tone="pending" label="Expires soon" />
 */
import { Tag } from 'antd';
import { humanise } from '../utils/format';
import { type StatusTone, statusColour, TONE_COLOURS } from '../utils/status';

interface Props {
  status?: string | null;
  label?: string;
  /** Colour group for chips that are not a stored status value. */
  tone?: StatusTone;
  /** Wider minimum width, for payment statuses and other long values. */
  wide?: boolean;
  className?: string;
}

export function StatusTag({ status, label, tone, wide = false, className }: Props) {
  const text = label ?? (status ? humanise(status) : undefined);
  if (!text) return null;
  const colour = tone ? TONE_COLOURS[tone] : statusColour(status);
  return (
    <Tag
      color={colour}
      variant="filled"
      className={`status-tag${wide ? ' status-tag--wide' : ''}${className ? ` ${className}` : ''}`}
      title={text}
    >
      {text}
    </Tag>
  );
}
