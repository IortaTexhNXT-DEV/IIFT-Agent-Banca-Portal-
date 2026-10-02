import { DownOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Card, Dropdown, Flex, Input, type MenuProps, Select, Table, Tag } from 'antd';
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
import { ErrorAlert } from '../../components/ErrorAlert';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime, humanise } from '../../utils/format';

const USER_TYPE_LABELS: Record<UserType, string> = { STAFF: 'Staff', AGENT: 'Agent', BANCA: 'Bank officer' };
const USER_TYPE_OPTIONS = Object.entries(USER_TYPE_LABELS).map(([value, label]) => ({ value: value as UserType, label }));
const STATUSES: UserStatus[] = ['ACTIVE', 'LOCKED', 'DISABLED'];
const INVALIDATE = ['/backoffice/users'];

interface Filters {
  search?: string;
  userType?: UserType;
  status?: UserStatus;
}

type Action = 'status' | 'unlock' | 'reset';

const isLocked = (user: UserSummary) => user.status === 'LOCKED' || (user.lockedUntil !== null && dayjs(user.lockedUntil).isAfter(dayjs()));

/** Activate/disable, unlock and password reset, each confirmed before it runs. */
function useAccountActions(onPassword: (user: UserSummary, password: string) => void) {
  const { modal } = App.useApp();
  const setStatus = useApiMutation((user: UserSummary) => api.put<UserSummary>(`/backoffice/users/${user.id}/status`, { status: user.status === 'DISABLED' ? 'ACTIVE' : 'DISABLED' }), {
    success: 'Account status changed',
    invalidate: INVALIDATE,
  });
  const unlock = useApiMutation((user: UserSummary) => api.post<UserSummary>(`/backoffice/users/${user.id}/unlock`), { success: 'Account unlocked', invalidate: INVALIDATE });
  const reset = useApiMutation((user: UserSummary) => api.post<TemporaryPassword>(`/backoffice/users/${user.id}/reset-password`), {
    invalidate: INVALIDATE,
    onSuccess: (result, user) => result.temporaryPassword && onPassword(user, result.temporaryPassword),
  });

  const confirm = (action: Action, user: UserSummary) => {
    const disabling = user.status !== 'DISABLED';
    const config = {
      status: {
        title: disabling ? `Disable ${user.username}?` : `Activate ${user.username}?`,
        content: disabling ? 'The user is signed out and can no longer sign in.' : 'The user can sign in again.',
        run: () => setStatus.mutateAsync(user),
      },
      unlock: { title: `Unlock ${user.username}?`, content: 'Failed sign-in attempts are cleared.', run: () => unlock.mutateAsync(user) },
      reset: {
        title: `Reset the password of ${user.username}?`,
        content: 'A temporary password is issued and all of the user’s sessions end.',
        run: () => reset.mutateAsync(user),
      },
    }[action];
    void modal.confirm({ title: config.title, content: config.content, okText: 'Confirm', okButtonProps: { danger: action !== 'unlock' }, onOk: () => config.run().catch(() => undefined) });
  };

  return { confirm, error: setStatus.error ?? unlock.error ?? reset.error };
}

/** BO-03: user administration for staff, agents and bank officers. */
export default function UsersPage() {
  const { user: me } = useAuth();
  const [filters, setFilters] = useState<Filters>({});
  const [editing, setEditing] = useState<UserSummary | 'new'>();
  const [password, setPassword] = useState<{ username: string; value: string }>();
  const users = usePagedQuery<UserSummary>('/backoffice/users', { ...filters });
  const actions = useAccountActions((user, value) => setPassword({ username: user.username, value }));
  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    users.resetPage();
  };

  const menuFor = (user: UserSummary): MenuProps['items'] => [
    { key: 'status', label: user.status === 'DISABLED' ? 'Activate' : 'Disable', danger: user.status !== 'DISABLED' },
    ...(isLocked(user) && user.status !== 'DISABLED' ? [{ key: 'unlock', label: 'Unlock' }] : []),
    ...(user.authSource === 'LOCAL' ? [{ key: 'reset', label: 'Reset password' }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Staff accounts, and the portal logins created for approved agents and bank officers"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Users' }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            New staff user
          </Button>
        }
      />
      <FilterBar>
        <Input.Search allowClear placeholder="User name, name or email" aria-label="Search users" style={{ width: 260 }} onSearch={(value) => update({ search: value.trim() || undefined })} />
        <Select allowClear placeholder="User type" aria-label="User type" style={{ width: 160 }} options={USER_TYPE_OPTIONS} onChange={(userType?: UserType) => update({ userType })} />
        <Select allowClear placeholder="Status" aria-label="Status" style={{ width: 150 }} options={enumOptions(STATUSES, humanise)} onChange={(status?: UserStatus) => update({ status })} />
      </FilterBar>
      <ErrorAlert error={actions.error} className="mb-16" />
      <Card className="content-card">
        <Table<UserSummary>
          size="middle"
          rowKey="id"
          loading={users.isFetching}
          dataSource={users.items}
          pagination={users.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No users match the filters' }}
          columns={[
            { title: 'User name', dataIndex: 'username' },
            { title: 'Name', dataIndex: 'fullName' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Type', dataIndex: 'userType', render: (type: UserType) => USER_TYPE_LABELS[type] },
            {
              title: 'Roles',
              dataIndex: 'roles',
              width: 260,
              render: (roles: UserSummary['roles']) => (
                <Flex gap={4} wrap>
                  {roles.map(({ role }) => (
                    <Tag key={role.id} variant="filled">
                      {role.name}
                    </Tag>
                  ))}
                </Flex>
              ),
            },
            { title: 'Sign-in', dataIndex: 'authSource', render: (source: string) => (source === 'LOCAL' ? 'Password' : 'Directory') },
            { title: 'Status', dataIndex: 'status', render: (_: unknown, user) => <StatusTag status={isLocked(user) && user.status !== 'DISABLED' ? 'LOCKED' : user.status} /> },
            { title: 'Last sign-in', dataIndex: 'lastLoginAt', render: formatDateTime },
            {
              key: 'actions',
              render: (_: unknown, user) => (
                <Flex gap={4} className="table-actions">
                  <Button size="small" type="link" onClick={() => setEditing(user)}>
                    Edit
                  </Button>
                  {user.id !== me?.id && (
                    <Dropdown menu={{ items: menuFor(user), onClick: ({ key }) => actions.confirm(key as Action, user) }} trigger={['click']}>
                      <Button size="small" type="link" aria-label={`More actions for ${user.username}`}>
                        More <DownOutlined />
                      </Button>
                    </Dropdown>
                  )}
                </Flex>
              ),
            },
          ]}
        />
      </Card>
      {editing && (
        <UserFormModal
          user={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
          onCreated={(result) => result.temporaryPassword && setPassword({ username: result.user.username, value: result.temporaryPassword })}
        />
      )}
      {password && <TemporaryPasswordModal username={password.username} password={password.value} onClose={() => setPassword(undefined)} />}
    </>
  );
}
