/**
 * Frame of the pages outside the shell (sign-in, change password): a brand panel on the
 * left (logo, product, module and three capabilities) and the form card on the right,
 * stacked on phones.
 */
import { AuditOutlined, FileProtectOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Card, Typography } from 'antd';
import { type ReactNode, useEffect } from 'react';
import { COMPANY_NAME, COPYRIGHT_YEAR, PRODUCT_NAME } from '../config/app';
import { PoweredBy, ReleaseLabel } from './Branding';

const MODULE_LINE = 'Agent/Banca Portal & Back-office';

const CAPABILITIES = [
  { icon: <FileProtectOutlined />, label: 'Quotation to e-Policy' },
  { icon: <SafetyCertificateOutlined />, label: 'Maker-checker control' },
  { icon: <AuditOutlined />, label: 'Audit-ready records' },
];

interface Props {
  title: string;
  /** One short line under the title, e.g. who the page is for. */
  lead?: string;
  children: ReactNode;
}

export function AuthLayout({ title, lead, children }: Props) {
  useEffect(() => {
    document.title = `${title} · ${PRODUCT_NAME}`;
  }, [title]);

  return (
    <div className="auth-layout">
      <aside className="auth-brand" aria-label={PRODUCT_NAME}>
        <div>
          <span className="auth-brand__logo-wrap">
            <img
              src="/iift-logo.png"
              alt="Insurans Islam Family Takaful"
              className="auth-brand__logo"
            />
          </span>
          <div className="auth-brand__org">{COMPANY_NAME}</div>
        </div>
        <div>
          <h2 className="auth-brand__product">{PRODUCT_NAME}</h2>
          <div className="auth-brand__module">{MODULE_LINE}</div>
          <ul className="auth-brand__capabilities">
            {CAPABILITIES.map((item) => (
              <li key={item.label} className="auth-brand__capability">
                <span className="auth-brand__capability-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="auth-brand__foot">
          © {COPYRIGHT_YEAR} {COMPANY_NAME}. Authorised users only; activity is recorded.
        </div>
      </aside>
      <main className="auth-main">
        <Card className="auth-card">
          <Typography.Title level={1} className="auth-card__title">
            {title}
          </Typography.Title>
          {lead && <p className="auth-card__lead">{lead}</p>}
          {children}
        </Card>
        <footer className="auth-main__footer">
          <ReleaseLabel />
          <PoweredBy />
        </footer>
      </main>
    </div>
  );
}
