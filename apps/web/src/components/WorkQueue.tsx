/**
 * WorkQueue – compact list of queues or follow-ups with a count each, linking to the list
 * that holds the work. Used on dashboards ("My tasks", "Work queues").
 */
import { RightOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { EmptyState } from './EmptyState';

export interface WorkItem {
  key: string;
  label: ReactNode;
  to: string;
  icon?: ReactNode;
  /** Second line, e.g. an amount or a participant name. */
  meta?: ReactNode;
  count?: number;
  tone?: 'default' | 'warning' | 'danger';
}

function countClass(item: WorkItem): string {
  if (!item.count) return 'work-list__count work-list__count--zero';
  return item.tone && item.tone !== 'default'
    ? `work-list__count work-list__count--${item.tone}`
    : 'work-list__count';
}

export function WorkQueue({ items, emptyLabel }: { items: WorkItem[]; emptyLabel: string }) {
  if (items.length === 0) return <EmptyState label={emptyLabel} inline />;
  return (
    <ul className="work-list">
      {items.map((item) => (
        <li key={item.key}>
          <Link to={item.to} className="work-list__item">
            {item.icon && <span className="work-list__icon">{item.icon}</span>}
            <span className="work-list__body">
              <span className="work-list__label">{item.label}</span>
              {item.meta && <span className="work-list__meta">{item.meta}</span>}
            </span>
            {item.count !== undefined && <span className={countClass(item)}>{item.count}</span>}
            <RightOutlined className="work-list__chevron" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
