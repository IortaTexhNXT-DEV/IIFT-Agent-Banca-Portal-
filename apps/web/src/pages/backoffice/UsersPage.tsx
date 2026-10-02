import { MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Input, type MenuProps, Select, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { TemporaryPassword, UserStatus, UserSummary } from '../../api/admin-types';
import type { UserType } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { TemporaryPasswordModal } from '../../components/admin/TemporaryPasswordModal';
import { enumOptions } from '../../components/admin/useCodes';
import { UserFormModal } from '../../components/admin/UserFormModal';
import { DataTable, dateTimeColumn, textColumn } from '../../components/DataTable';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';
import '../../styles/admin.css';

const USER_TYPE_LABELS: Record<UserType, string> = {
  STAFF: 'Staff',
  AGENT: 'Agent',
  BANCA: 'Bank officer',
};
const USER_TYPE_OPTIONS = Object.entries(USER_TYPE_LABELS).map(([value, label]) => ({
  value: value as UserType,
  label,
}));
const STATUSES: UserStatus[] = ['ACTIVE', 'LOCKED', 'DISABLED'];
const INVALIDATE = ['/backoffice/users'];
/** Roles shown as tags before the rest collapse into a "+n" tag. */
const VISIBLE_ROLES = 1;

interface Filters {
  search?: string;
  userType?: UserType;
  status?: UserStatus;
}

type Action = 'edit' | 'status' | 'unlock' | 'reset';

const isLocked = (user: UserSummary) =>
  user.status === 'LOCKED' ||
  (user.lockedUntil !== null && dayjs(user.lockedUntil).isAfter(dayjs()));

function menuFor(user: UserSummary, self: boolean): MenuProps['items'] {
  const items: MenuProps['items'] = [{ key: 'edit', label: 'Edit' }];
  if (self) return items;
  items.push({ type: 'divider' });
  if (isLocked(user) && user.status !== 'DISABLED') items.push({ key: 'unlock', label: 'Unlock' });
  if (user.authSource === 'LOCAL') items.push({ key: 'reset', label: 'Reset password' });
  items.push({
    key: 'status',
    label: user.status === 'DISABLED' ? 'Activate' : 'Disable',
    danger: user.status !== 'DISABLED',
  });
  return items;
}

/** Activate/disable, unlock and password reset, each confirmed before it runs. */
function useAccountActions(onPassword: (user: UserSummary, password: string) => void) {
  const { modal } = App.useApp();
  const setStatus = useApiMutation(
    (user: UserSummary) =>
      api.put<UserSummary>(`/backoffice/users/${user.id}/status`, {
        status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED',
      }),
    {
      success: 'Account status changed',
      invalidate: INVALIDATE,
    },
  );
  const unlock = useApiMutation(
    (user: UserSummary) => api.post<UserSummary>(`/backoffice/users/${user.id}/unlock`),
    { success: 'Account unlocked', invalidate: INVALIDATE },
  );
  const reset = useApiMutation(
    (user: UserSummary) =>
      api.post<TemporaryPassword>(`/backoffice/users/${user.id}/reset-password`),
    {
      invalidate: INVALIDATE,
      onSuccess: (result, user) =>
        result.temporaryPassword && onPassword(user, result.temporaryPassword),
    },
  );

  const confirm = (action: Exclude<Action, 'edit'>, user: UserSummary) => {
    const disabling = user.status !== 'DISABLED';
    const config = {
      status: {
        title: disabling ? `Disable ${user.username}?` : `Activate ${user.username}?`,
        content: disabling ? 'The user is signed out and cannot sign in.' : 'The user can sign in.',
        run: () => setStatus.mutateAsync(user),
      },
      unlock: {
        title: `Unlock ${user.username}?`,
        content: 'Failed sign-in attempts are cleared.',
        run: () => unlock.mutateAsync(user),
      },
      reset: {
        title: `Reset the password of ${user.username}?`,
        content: 'A temporary password is issued and all sessions end.',
        run: () => reset.mutateAsync(user),
      },
    }[action];
    void modal.confirm({
      title: config.title,
      content: config.content,
      okText: 'Confirm',
      okButtonProps: { danger: action !== 'unlock' },
      onOk: () => config.run().catch(() => undefined),
    });
  };

  return { confirm, error: setStatus.error ?? unlock.error ?? reset.error };
}

function RoleTags({ roles }: { roles: UserSummary['roles'] }) {
  const names = roles.map(({ role }) => role.name);
  const hidden = names.slice(VISIBLE_ROLES);
  return (
    <span className="tag-row">
      {names.slice(0, VISIBLE_ROLES).map((name) => (
        <Tag key={name} variant="filled">
          {name}
        </Tag>
      ))}
      {hidden.length > 0 && (
        <Tooltip title={hidden.join(', ')}>
          <Tag variant="filled">+{hidden.length}</Tag>
        </Tooltip>
      )}
    </span>
  );
}

/** BO-03: user administration for staff, agents and bank officers. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [editing, setEditing] = useState<UserSummary | 'new'>();
  const [password, setPassword] = useState<{ username: string; value: string }>();
  const users = usePagedQuery<UserSummary>('/backoffice/users', { ...filters });
  const actions = useAccountActions((user, value) =>
    setPassword({ username: user.username, value }),
  );
  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    users.resetPage();
  };
  const run = (action: Action, user: UserSummary) => {
    if (action === 'edit') setEditing(user);
    else actions.confirm(action, user);
  };

  return (
    <>
      <PageHeader
        title="Users"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Users' }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            New staff user
          </Button>
        }
      />
      <ErrorAlert error={actions.error} className="mb-16" />
      <TableCard
        toolbar={
          <>
            <Input.Search
              allowClear
              placeholder="User name, name or email"
              aria-label="Search users"
              className="filter-search"
              onSearch={(value) => update({ search: value.trim() || undefined })}
            />
            <Select
              allowClear
              placeholder="User type"
              aria-label="User type"
              className="filter-select"
              options={USER_TYPE_OPTIONS}
              onChange={(userType?: UserType) => update({ userType })}
            />
            <Select
              allowClear
              placeholder="Status"
              aria-label="Status"
              className="filter-select"
              options={enumOptions(STATUSES, humanise)}
              onChange={(status?: UserStatus) => update({ status })}
            />
          </>
        }
      >
        <DataTable<UserSummary>
          rowKey="id"
          scroll={{}}
          loading={users.isFetching}
          dataSource={users.items}
          pagination={users.pagination}
          locale={{ emptyText: 'No users' }}
          onRowClick={(user) => setEditing(user)}
          columns={[
            {
              title: 'User name',
              dataIndex: 'username',
              width: 140,
              render: (username: string, user) => (
                <span className="tag-row">
                  {username}
                  {user.authSource === 'DIRECTORY' && (
                    <Tooltip title="Signs in through the corporate directory">
                      <Tag variant="filled">Directory</Tag>
                    </Tooltip>
                  )}
                </span>
              ),
            },
            textColumn('Name', 'fullName', 220),
            textColumn('Email', 'email'),
            {
              title: 'Type',
              dataIndex: 'userType',
              width: 100,
              render: (type: UserType) => USER_TYPE_LABELS[type],
            },
            {
              title: 'Roles',
              dataIndex: 'roles',
              width: 250,
              render: (roles: UserSummary['roles']) => <RoleTags roles={roles} />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 90,
              render: (_: unknown, user) => (
                <StatusTag
                  status={isLocked(user) && user.status !== 'DISABLED' ? 'LOCKED' : user.status}
                />
              ),
            },
            dateTimeColumn('Last sign-in', 'lastLoginAt', 150),
            {
              key: 'actions',
              width: 48,
              align: 'right',
              render: (_: unknown, user) => (
                <Dropdown
                  menu={{
                    items: menuFor(user, user.id === me?.id),
                    onClick: ({ key }) => run(key as Action, user),
                  }}
                  trigger={['click']}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<MoreOutlined />}
                    aria-label={`Actions for ${user.username}`}
                  />
                </Dropdown>
              ),
            },
          ]}
        />
      </TableCard>
      {editing && (
        <UserFormModal
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onCreated={(result) =>
            result.temporaryPassword &&
            setPassword({ username: result.user.username, value: result.temporaryPassword })
          }
        />
      )}
      {password && (
        <TemporaryPasswordModal
          username={password.username}
          password={password.value}
          onClose={() => setPassword(undefined)}
        />
      )}
    </>
  );
}
