/**
 * KpiTile / KpiGrid – fixed-height metric tiles for dashboards and summary rows.
 *
 *   <KpiGrid columns={6}>
 *     <KpiTile label="Active policies" value={26} icon={<FileProtectOutlined />} to="/portal/policies" />
 *   </KpiGrid>
 *
 * Labels are short sentence case and stay on one line; use `sub` for a secondary figure
 * ("B$ 75.00 outstanding"). `tone` colours the icon (and the value for danger) only.
 */
import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router';

export type KpiTone = 'default' | 'accent' | 'warning' | 'danger';

interface TileProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  sub?: ReactNode;
  to?: string;
  tone?: KpiTone;
}

export function KpiTile({ label, value, icon, sub, to, tone = 'default' }: TileProps) {
  const body = (
    <>
      <div className="kpi-tile__head">
        <span className="kpi-tile__label" title={label}>
          {label}
        </span>
        {icon && <span className="kpi-tile__icon">{icon}</span>}
      </div>
      <div className="kpi-tile__value">{value}</div>
      <div className="kpi-tile__sub">{sub}</div>
    </>
  );
  const className = `kpi-tile kpi-tile--${tone}`;
  return to ? (
    <Link to={to} className={className} aria-label={label}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** Equal-width tile row; drops to three, then two columns on narrower screens. */
export function KpiGrid({ columns = 4, children }: { columns?: number; children: ReactNode }) {
  return (
    <div className="kpi-grid" style={{ '--kpi-columns': columns } as CSSProperties}>
      {children}
    </div>
  );
}
