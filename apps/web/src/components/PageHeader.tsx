/**
 * PageHeader – the first element of every page inside the shell.
 *
 *   breadcrumb   Home › Section › Record (always start with the module home)
 *   title        record reference or page name, 20px semibold
 *   tags         status chips shown beside the title
 *   meta         short key facts under the title ("Agent code AG-000001"); never sentences
 *   extra        page actions, right-aligned (primary action last)
 */
import { Breadcrumb, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface Crumb {
  title: string;
  to?: string;
}

export interface MetaItem {
  /** Short label shown in grey before the value, e.g. "Product". Omit for self-explanatory values. */
  label?: string;
  value: ReactNode;
}

interface Props {
  title: ReactNode;
  breadcrumb?: Crumb[];
  tags?: ReactNode;
  meta?: (MetaItem | null | false | undefined | '')[];
  extra?: ReactNode;
}

export function PageHeader({ title, breadcrumb, tags, meta, extra }: Props) {
  const facts = (meta ?? []).filter((item): item is MetaItem => Boolean(item));
  return (
    <header className="page-header">
      <div className="page-header__main">
        {breadcrumb && (
          <Breadcrumb
            className="page-header__breadcrumb"
            items={breadcrumb.map((crumb) => ({
              title: crumb.to ? <Link to={crumb.to}>{crumb.title}</Link> : crumb.title,
            }))}
          />
        )}
        <div className="page-header__title-row">
          <Typography.Title level={1} className="page-header__title">
            {title}
          </Typography.Title>
          {tags}
        </div>
        {facts.length > 0 && (
          <div className="page-header__meta">
            {facts.map((item, index) => (
              <span key={item.label ?? index} className="page-header__meta-item">
                {item.label && <span className="page-header__meta-label">{item.label}</span>}
                <span>{item.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
      {extra && <div className="page-header__actions">{extra}</div>}
    </header>
  );
}
