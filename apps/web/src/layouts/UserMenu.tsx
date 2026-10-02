import { DownOutlined, LockOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Button, Dropdown, type MenuProps } from 'antd';
import { useNavigate } from 'react-router';
import { useApiQuery } from '../api/hooks';
import type { AgentDetail, SessionUser } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { AGENT_TYPE_LABELS } from '../components/admin/agents';
import { P } from '../utils/permissions';

const USER_TYPE_LABELS: Record<SessionUser['userType'], string> = {
  AGENT: 'Agent',
  BANCA: 'Bank officer',
  STAFF: 'IIFT staff',
};

const SKIPPED_NAME_PARTS = new Set(['bin', 'binti', 'haji', 'hajah', 'dato', 'datin']);

/** Two initials from the given names, ignoring honorifics and patronymic particles. */
export function initials(fullName: string): string {
  const parts = fullName
    .split(/\s+/)
    .filter((part) => part && !SKIPPED_NAME_PARTS.has(part.toLowerCase()));
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/** Signed-in user with role and agency, profile and password links and sign-out. */
export function UserMenu({ profilePath }: { profilePath?: string }) {
  const { user, can, logout } = useAuth();
  const navigate = useNavigate();
  const profile = useApiQuery<AgentDetail>(
    user?.audience === 'PORTAL' && can(P.portalProfileView) ? '/portal/profile' : null,
  );
  if (!user) return null;

  const agent = profile.data;
  const role = agent ? AGENT_TYPE_LABELS[agent.agentType] : USER_TYPE_LABELS[user.userType];
  const identity = (
    <div className="user-menu__head">
      <Avatar size={40} className="user-avatar">
        {initials(user.fullName)}
      </Avatar>
      <div>
        <div className="user-menu__name">{user.fullName}</div>
        <div className="user-menu__meta">
          {agent ? `${agent.agentCode} · ${role}` : `${user.username} · ${role}`}
          {agent && <div>{agent.agency.name}</div>}
        </div>
      </div>
    </div>
  );
  const items: MenuProps['items'] = [
    { type: 'group' as const, key: 'identity', label: identity },
    { type: 'divider' as const },
    ...(profilePath
      ? [
          {
            key: 'profile',
            icon: <UserOutlined />,
            label: 'My profile',
            onClick: () => navigate(profilePath),
          },
        ]
      : []),
    {
      key: 'password',
      icon: <LockOutlined />,
      label: 'Change password',
      onClick: () => navigate('/change-password'),
    },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      onClick: () => void logout().then(() => navigate('/login')),
    },
  ];

  return (
    <Dropdown
      menu={{ items }}
      trigger={['click']}
      placement="bottomRight"
      classNames={{ root: 'user-menu' }}
    >
      <Button type="text" className="user-button" aria-label="Account menu">
        <Avatar size={28} className="user-avatar">
          {initials(user.fullName)}
        </Avatar>
        <span className="user-button__text hide-mobile">
          <span className="user-button__name">{user.fullName}</span>
          <span className="user-button__role">{agent ? agent.agency.name : role}</span>
        </span>
        <DownOutlined className="muted hide-mobile" />
      </Button>
    </Dropdown>
  );
}
