import { Breadcrumb, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface Crumb {
  title: string;
  to?: string;
}

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  breadcrumb?: Crumb[];
  extra?: ReactNode;
}

/** Page title row used by every screen: breadcrumb, title, optional subtitle and actions. */
export function PageHeader({ title, subtitle, breadcrumb, extra }: Props) {
  return (
    <div className="page-header">
      {breadcrumb && (
        <Breadcrumb
          className="page-header__breadcrumb"
          items={breadcrumb.map((crumb) => ({ title: crumb.to ? <Link to={crumb.to}>{crumb.title}</Link> : crumb.title }))}
        />
      )}
      <Flex justify="space-between" align="flex-end" gap={16} wrap>
        <div>
          <Typography.Title level={3} className="page-header__title">
            {title}
          </Typography.Title>
          {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
        </div>
        {extra && <Flex gap={8} wrap>{extra}</Flex>}
      </Flex>
    </div>
  );
}
