import { Result } from 'antd';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

/** Renders children only when the user holds the permission; otherwise a 403 page. */
export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return <Result status="403" title="Not authorised" subTitle="Your role does not include access to this page." />;
  }
  return <>{children}</>;
}
