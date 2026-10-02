import { Card } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  to?: string;
  tone?: 'default' | 'warning' | 'danger';
}

/** KPI tile used on dashboards; optionally links to the underlying list. */
export function StatCard({ label, value, hint, to, tone = 'default' }: Props) {
  const card = (
    <Card size="small" className={`stat-card stat-card--${tone}${to ? ' stat-card--link' : ''}`}>
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value">{value}</div>
      {hint && <div className="stat-card__hint">{hint}</div>}
    </Card>
  );
  return to ? <Link to={to}>{card}</Link> : card;
}
