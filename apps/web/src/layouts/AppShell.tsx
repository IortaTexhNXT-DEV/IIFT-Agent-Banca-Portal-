import { BellOutlined, DownOutlined, LockOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Dropdown, Layout, Menu, type MenuProps, Tooltip } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useApiQuery } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import type { MenuGroup } from './menus';

interface Props {
  basePath: '/portal' | '/backoffice';
  moduleName: string;
  menu: MenuGroup[];
  profilePath?: string;
}

const UNREAD_REFRESH_MS = 60_000;

/** Header, navigation and content frame shared by the portal and the back-office. */
export function AppShell({ basePath, moduleName, menu, profilePath }: Props) {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const unread = useApiQuery<{ count: number }>('/common/notifications/unread-count', undefined, { refetchInterval: UNREAD_REFRESH_MS });

  const items = useMemo<MenuProps['items']>(
    () =>
      menu
        .map((group, index) => {
          const entries = group.entries
            .filter((entry) => !entry.anyOf || entry.anyOf.some((permission) => can(permission)))
            .map((entry) => ({ key: entry.path, icon: entry.icon, label: entry.label }));
          if (entries.length === 0) return null;
          return group.label ? { type: 'group' as const, key: `group-${index}`, label: group.label, children: entries } : entries;
        })
        .flat()
        .filter((item) => item !== null),
    [menu, can],
  );

  // Highlight the deepest menu entry that prefixes the current path.
  const selected = useMemo(() => {
    const paths = menu.flatMap((group) => group.entries.map((entry) => entry.path));
    const match = paths.filter((path) => location.pathname === path || location.pathname.startsWith(`${path}/`)).sort((a, b) => b.length - a.length)[0];
    return match ? [match] : [];
  }, [menu, location.pathname]);

  const userMenu: MenuProps['items'] = [
    ...(profilePath ? [{ key: 'profile', icon: <UserOutlined />, label: 'My profile', onClick: () => navigate(profilePath) }] : []),
    { key: 'password', icon: <LockOutlined />, label: 'Change password', onClick: () => navigate('/change-password') },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Sign out', onClick: () => void logout().then(() => navigate('/login')) },
  ];

  return (
    <Layout className="app-shell">
      <Layout.Header className="app-header">
        <div className="app-header__brand">
          <img src="/iift-logo.png" alt="Insurans Islam Family Takaful" className="app-header__logo" />
          <div className="app-header__titles">
            <span className="app-header__product">SalesVerse 2.0</span>
            <span className="app-header__module">{moduleName}</span>
          </div>
        </div>
        <div className="app-header__actions">
          <Tooltip title="Notifications">
            <Badge count={unread.data?.count ?? 0} size="small" overflowCount={99}>
              <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Notifications" onClick={() => navigate(`${basePath}/notifications`)} />
            </Badge>
          </Tooltip>
          <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
            <Button type="text" className="app-header__user">
              <Avatar size="small" className="app-header__avatar">
                {user?.fullName.charAt(0)}
              </Avatar>
              <span className="app-header__username">{user?.fullName}</span>
              <DownOutlined />
            </Button>
          </Dropdown>
        </div>
      </Layout.Header>
      <Layout>
        <Layout.Sider width={248} collapsedWidth={64} collapsed={collapsed} className="app-sider" breakpoint="lg" onBreakpoint={setCollapsed} trigger={null}>
          <Menu mode="inline" items={items} selectedKeys={selected} onClick={({ key }) => navigate(key)} className="app-menu" />
          <Button type="text" className="app-sider__toggle" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} aria-label="Toggle navigation" />
        </Layout.Sider>
        <Layout.Content className="app-content">
          <Outlet />
          <footer className="app-footer">SalesVerse 2.0 · Insurans Islam Family Takaful Sendirian Berhad</footer>
        </Layout.Content>
      </Layout>
    </Layout>
  );
}
