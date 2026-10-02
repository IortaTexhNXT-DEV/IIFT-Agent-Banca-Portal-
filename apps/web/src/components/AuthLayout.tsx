/** Frame of the pages outside the shell (sign-in, change password): logo, one card, footer. */
import { Card, Typography } from 'antd';
import type { ReactNode } from 'react';
import { COMPANY_NAME, PRODUCT_NAME } from '../config/app';
import { PoweredBy, ReleaseLabel } from './Branding';

export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="auth-layout">
      <main className="auth-layout__main">
        <div className="auth-layout__brand">
          <img
            src="/iift-logo.png"
            alt="Insurans Islam Family Takaful"
            className="auth-layout__logo"
          />
          <div>
            <div className="auth-layout__product">{PRODUCT_NAME}</div>
            <div className="auth-layout__org">{COMPANY_NAME}</div>
          </div>
        </div>
        <Card className="auth-card">
          <Typography.Title level={1} className="auth-card__title">
            {title}
          </Typography.Title>
          {children}
        </Card>
      </main>
      <footer className="auth-layout__footer">
        <ReleaseLabel />
        <PoweredBy />
      </footer>
    </div>
  );
}
