import { PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Flex,
  Form,
  Input,
  Popconfirm,
  Row,
  Select,
  Table,
  Tag,
} from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { PermissionDefinition, Role } from '../../api/admin-types';
import type { Audience } from '../../api/types';
import { CellText } from '../../components/admin/CellText';
import { PermissionPicker } from '../../components/admin/PermissionPicker';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { formatNumber } from '../../utils/format';

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
      extra={
        <Flex gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.submit()}>
            Save
          </Button>
        </Flex>
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
                name: role.name,
                description: role.description ?? '',
                permissions: role.permissions,
              }
            : { audience: 'BACKOFFICE', permissions: [] }
        }
      >
        <Row gutter={16}>
          {!role && (
            <>
              <Col xs={24} md={12}>
                <Form.Item
                  name="code"
                  label="Code"
                  normalize={(value: string) => value.toUpperCase()}
                  rules={[
                    { required: true, message: 'Enter a code' },
                    {
                      pattern: CODE_PATTERN,
                      message: 'Capital letters, digits and underscores, starting with a letter',
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="audience" label="Used in" rules={[{ required: true }]}>
                  <Select
                    options={Object.entries(AUDIENCE_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                    onChange={() => form.setFieldValue('permissions', [])}
                  />
                </Form.Item>
              </Col>
            </>
          )}
          <Col span={24}>
            <Form.Item
              name="name"
              label="Name"
              rules={[
                { required: true, whitespace: true, message: 'Enter the role name' },
                { min: 2, max: 100 },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item name="description" label="Description" rules={[{ max: 500 }]}>
              <Input.TextArea rows={2} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="permissions" label="Permissions" rules={[{ type: 'array', max: 100 }]}>
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
      <Card className="content-card">
        <QueryState query={roles}>
          {(items) => (
            <Table<Role>
              size="middle"
              rowKey="id"
              pagination={false}
              dataSource={items}
              scroll={{ x: 'max-content' }}
              columns={[
                {
                  title: 'Role',
                  dataIndex: 'name',
                  render: (name: string, role) => (
                    <Flex gap={8} align="center">
                      {name}
                      {role.isSystem && <Tag variant="filled">System</Tag>}
                    </Flex>
                  ),
                },
                { title: 'Code', dataIndex: 'code' },
                {
                  title: 'Used in',
                  dataIndex: 'audience',
                  render: (audience: Audience) => AUDIENCE_LABELS[audience],
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  render: (description: string | null) => (
                    <CellText text={description} width={300} />
                  ),
                },
                {
                  title: 'Permissions',
                  dataIndex: 'permissions',
                  align: 'right',
                  render: (permissions: string[]) => formatNumber(permissions.length),
                },
                { title: 'Users', dataIndex: 'userCount', align: 'right', render: formatNumber },
                {
                  key: 'actions',
                  render: (_: unknown, role) => (
                    <Flex gap={4} className="table-actions">
                      <Button
                        size="small"
                        type="link"
                        disabled={!catalogue.data}
                        onClick={() => setEditing(role)}
                      >
                        Edit
                      </Button>
                      {!role.isSystem && role.userCount === 0 && (
                        <Popconfirm
                          title={`Delete the role ${role.name}?`}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => remove.mutate(role)}
                        >
                          <Button size="small" type="link" danger>
                            Delete
                          </Button>
                        </Popconfirm>
                      )}
                    </Flex>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Card>
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
