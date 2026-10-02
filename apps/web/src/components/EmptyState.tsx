/**
 * EmptyState – compact "nothing here" marker for cards and panels: an icon, a short label
 * ("No drafts") and optionally one action. Never a sentence or an illustration.
 */
import { InboxOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';

interface Props {
  label: string;
  icon?: ReactNode;
  action?: ReactNode;
  /** Single row, for small panels. */
  inline?: boolean;
}

export function EmptyState({ label, icon = <InboxOutlined />, action, inline = false }: Props) {
  return (
    <div className={`empty-state${inline ? ' empty-state--inline' : ''}`}>
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
      {action}
    </div>
  );
}
