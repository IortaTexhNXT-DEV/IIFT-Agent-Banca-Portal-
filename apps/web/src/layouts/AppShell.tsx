import {
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { Button, Drawer, Grid, Layout, Tooltip } from 'antd';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { PoweredBy, ReleaseLabel } from '../components/Branding';
import { COMPANY_NAME, COPYRIGHT_YEAR, PRODUCT_NAME } from '../config/app';
import { P } from '../utils/permissions';
import { GlobalSearch } from './GlobalSearch';
import { type MenuGroup, menuTrail } from './menus';
import { NotificationBell } from './NotificationBell';
import { SideNav } from './SideNav';
import { UserMenu } from './UserMenu';

interface Props {
  basePath: '/portal' | '/backoffice';
  moduleName: string;
  menu: MenuGroup[];
  profilePath?: string;
}

const COLLAPSED_KEY = 'salesverse.nav.collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Header, navigation, content frame and footer shared by the portal and the back-office. */
export function AppShell({ basePath, moduleName, menu, profilePath }: Props) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const screens = Grid.useBreakpoint();
  const mobile = screens.md === false;
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const canQuote = basePath === '/portal' && can(P.portalPoliciesQuote);

  useEffect(() => {
    const { entry } = menuTrail(menu, pathname);
    document.title = entry ? `${entry.label} · ${PRODUCT_NAME}` : PRODUCT_NAME;
  }, [menu, pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
    } catch {
      // Not remembered when storage is unavailable.
    }
  };

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header__left">
          {mobile && (
            <Button
              type="text"
              icon={<MenuOutlined />}
              aria-label="Open navigation"
              onClick={() => setDrawerOpen(true)}
            />
          )}
          <Link to={basePath} className="app-brand">
            <img
              src="/iift-logo.png"
              alt="Insurans Islam Family Takaful"
              className="app-brand__logo"
            />
            <span className="app-brand__titles">
              <span className="app-brand__product">{PRODUCT_NAME}</span>
              <span className="app-brand__module">{moduleName}</span>
            </span>
          </Link>
        </div>
        {!mobile && (
          <div className="app-header__search">
            <GlobalSearch basePath={basePath} />
          </div>
        )}
        <div className="app-header__right">
          {canQuote && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={pathname === '/portal/quotations/new'}
              onClick={() => navigate('/portal/quotations/new')}
              aria-label="New quotation"
            >
              {!mobile && 'New quotation'}
            </Button>
          )}
          <NotificationBell basePath={basePath} />
          {!mobile && <span className="app-header__divider" aria-hidden="true" />}
          <UserMenu profilePath={profilePath} />
        </div>
      </Layout.Header>
      <Layout hasSider={!mobile}>
        {!mobile && (
          <Layout.Sider
            width={240}
            collapsedWidth={64}
            collapsed={collapsed}
            className="app-sider"
            trigger={null}
          >
            <SideNav menu={menu} basePath={basePath} collapsed={collapsed} />
            <div className="app-sider__footer">
              <Tooltip
                title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                placement="right"
              >
                <Button
                  type="text"
                  size="small"
                  icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                  onClick={toggleCollapsed}
                  aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
                />
              </Tooltip>
            </div>
          </Layout.Sider>
        )}
        <Layout.Content className="app-content">
          <main className="app-page">
            <Outlet />
          </main>
          <footer className="app-footer">
            <span>
              © {COPYRIGHT_YEAR} {COMPANY_NAME} · {PRODUCT_NAME} <ReleaseLabel />
            </span>
            <PoweredBy />
          </footer>
        </Layout.Content>
      </Layout>
      {mobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement="left"
          size={280}
          title={moduleName}
          className="mobile-nav"
          destroyOnHidden
        >
          <div className="mobile-nav__search">
            <GlobalSearch basePath={basePath} />
          </div>
          <SideNav menu={menu} basePath={basePath} onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      )}
    </Layout>
  );
}
