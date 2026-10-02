import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Drawer, Form, Input, Popconfirm, Select, Tag, Tooltip } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { PermissionDefinition, Role } from '../../api/admin-types';
import type { Audience } from '../../api/types';
import { PermissionPicker } from '../../components/admin/PermissionPicker';
import { ActionBar } from '../../components/ActionBar';
import { DataTable, textColumn } from '../../components/DataTable';
import { ErrorAlert } from '../../components/ErrorAlert';
import { FormSection } from '../../components/FormSection';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { TableCard } from '../../components/TableCard';
import { formatNumber } from '../../utils/format';
import '../../styles/admin.css';

const ROLES_PATH = '/backoffice/roles';
const AUDIENCE_LABELS: Record<Audience, string> = {
  PORTAL: 'Agent & Banca Portal',
  BACKOFFICE: 'Back-office',
};
const CODE_PATTERN = /^[A-Z][A-Z0-9_]{2,49}$/;

interface RoleValues {
  code: string;
  audience: Audience;
  name: string;
  description?: string;
  permissions: string[];
}

function RoleDrawer({
  role,
  catalogue,
  onClose,
}: {
  role?: Role;
  catalogue: PermissionDefinition[];
  onClose(): void;
}) {
  const [form] = Form.useForm<RoleValues>();
  const audience = Form.useWatch('audience', form) ?? role?.audience ?? 'BACKOFFICE';
  const save = useApiMutation(
    (values: RoleValues) => {
      const body = {
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        permissions: values.permissions,
      };
      return role
        ? api.put<Role>(`${ROLES_PATH}/${role.id}`, body)
        : api.post<Role>(ROLES_PATH, { ...body, code: values.code, audience: values.audience });
    },
    {
      success: role ? 'Role saved' : 'Role created',
      invalidate: [ROLES_PATH, '/backoffice/role-options'],
      onSuccess: onClose,
    },
  );

  return (
    <Drawer
      open
      size={760}
      title={role ? `Edit role – ${role.name}` : 'New role'}
      onClose={onClose}
      destroyOnHidden
      extra={role?.isSystem && <Tag variant="filled">System</Tag>}
      footer={
        <ActionBar>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            Save
          </Button>
        </ActionBar>
      }
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => save.mutate(values)}
        layout="vertical"
        requiredMark="optional"
        initialValues={
          role
            ? {
                code: role.code,
                audience: role.audience,
                name: role.name,
                description: role.description ?? '',
                permissions: role.permissions,
              }
            : { audience: 'BACKOFFICE', permissions: [] }
        }
      >
        <FormSection title="Role" columns={2}>
          <Form.Item
            name="code"
            label="Code"
            normalize={(value: string) => value.toUpperCase()}
            rules={[
              { required: true, message: 'Enter a code' },
              { pattern: CODE_PATTERN, message: 'Capitals, digits and underscores' },
            ]}
          >
            <Input disabled={Boolean(role)} />
          </Form.Item>
          <Form.Item name="audience" label="Used in" rules={[{ required: true }]}>
            <Select
              disabled={Boolean(role)}
              options={Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({
                value,
                label,
              }))}
              onChange={() => form.setFieldValue('permissions', [])}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Name"
            className="field--full"
            rules={[
              { required: true, whitespace: true, message: 'Enter the role name' },
              { min: 2, max: 100 },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            className="field--full"
            rules={[{ max: 500 }]}
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </FormSection>
        <Form.Item name="permissions" noStyle rules={[{ type: 'array', max: 100 }]}>
          <PermissionPicker
            permissions={catalogue.filter((permission) => permission.audience === audience)}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}

/** BO-04: roles and the permissions they grant; system roles cannot be deleted. */
export default function RolesPage() {
  const { message } = App.useApp();
  const roles = useApiQuery<Role[]>(ROLES_PATH);
  const catalogue = useApiQuery<PermissionDefinition[]>(`${ROLES_PATH}/permissions`);
  const [editing, setEditing] = useState<Role | 'new'>();
  const remove = useApiMutation((role: Role) => api.delete(`${ROLES_PATH}/${role.id}`), {
    success: 'Role deleted',
    invalidate: [ROLES_PATH, '/backoffice/role-options'],
    onError: (error) => message.error(error.message),
  });

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Roles & permissions' }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!catalogue.data}
            onClick={() => setEditing('new')}
          >
            New role
          </Button>
        }
      />
      <QueryState query={roles}>
        {(items) => (
          <TableCard>
            <DataTable<Role>
              rowKey="id"
              scroll={{}}
              pagination={false}
              dataSource={items}
              locale={{ emptyText: 'No roles' }}
              onRowClick={catalogue.data ? (role) => setEditing(role) : undefined}
              columns={[
                {
                  title: 'Role',
                  dataIndex: 'name',
                  width: 310,
                  render: (name: string, role) => (
                    <span className="tag-row">
                      {name}
                      {role.isSystem && (
                        <Tooltip title="Installed with the system; cannot be deleted">
                          <Tag variant="filled">System</Tag>
                        </Tooltip>
                      )}
                    </span>
                  ),
                },
                { title: 'Code', dataIndex: 'code', width: 230 },
                {
                  title: 'Used in',
                  dataIndex: 'audience',
                  width: 160,
                  render: (audience: Audience) => AUDIENCE_LABELS[audience],
                },
                textColumn('Description', 'description'),
                {
                  title: 'Permissions',
                  dataIndex: 'permissions',
                  width: 120,
                  align: 'right',
                  render: (permissions: string[]) => formatNumber(permissions.length),
                },
                {
                  title: 'Users',
                  dataIndex: 'userCount',
                  width: 70,
                  align: 'right',
                  render: formatNumber,
                },
                {
                  key: 'actions',
                  width: 80,
                  align: 'right',
                  render: (_: unknown, role) => (
                    <span className="row-actions">
                      <Tooltip title="Edit">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          aria-label={`Edit ${role.name}`}
                          disabled={!catalogue.data}
                          onClick={() => setEditing(role)}
                        />
                      </Tooltip>
                      {!role.isSystem && role.userCount === 0 && (
                        <Popconfirm
                          title={`Delete the role ${role.name}?`}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => remove.mutate(role)}
                        >
                          <Tooltip title="Delete">
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              aria-label={`Delete ${role.name}`}
                            />
                          </Tooltip>
                        </Popconfirm>
                      )}
                    </span>
                  ),
                },
              ]}
            />
          </TableCard>
        )}
      </QueryState>
      {editing && catalogue.data && (
        <RoleDrawer
          role={editing === 'new' ? undefined : editing}
          catalogue={catalogue.data}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
