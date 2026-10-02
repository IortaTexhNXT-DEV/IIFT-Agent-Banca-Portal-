import { PlusOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Switch, Table } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { CodeItem } from '../../api/types';
import { humanise } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { FilterBar } from '../FilterBar';
import '../../styles/admin.css';

const PATH = '/backoffice/config/codes';
const INVALIDATE = [PATH, '/common/codes'];
const CODE_PATTERN = /^[A-Za-z0-9_]{1,50}$/;

interface CodeValues {
  code: string;
  label: string;
  sortOrder?: number;
}

function CodeModal({
  category,
  item,
  onClose,
}: {
  category: string;
  item?: CodeItem;
  onClose(): void;
}) {
  const [form] = Form.useForm<CodeValues>();
  const save = useApiMutation(
    (values: CodeValues) =>
      item
        ? api.patch<CodeItem>(`${PATH}/${item.id}`, {
            label: values.label.trim(),
            sortOrder: values.sortOrder,
          })
        : api.post<CodeItem>(PATH, {
            category,
            code: values.code.trim(),
            label: values.label.trim(),
            sortOrder: values.sortOrder,
          }),
    { success: item ? 'Value saved' : 'Value added', invalidate: INVALIDATE, onSuccess: onClose },
  );

  return (
    <Modal
      open
      title={item ? `Edit ${item.code}` : `Add ${humanise(category).toLowerCase()} value`}
      okText={item ? 'Save' : 'Add'}
      okButtonProps={{ loading: save.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => save.mutate(values)}
        layout="vertical"
        requiredMark="optional"
        initialValues={
          item ? { code: item.code, label: item.label, sortOrder: item.sortOrder } : undefined
        }
      >
        <Form.Item
          name="code"
          label="Code"
          extra={
            item
              ? 'Codes cannot be changed once in use'
              : 'Stored on records; letters, digits and underscores'
          }
          rules={[
            { required: true, message: 'Enter a code' },
            { pattern: CODE_PATTERN, message: 'Up to 50 letters, digits or underscores' },
          ]}
        >
          <Input disabled={Boolean(item)} />
        </Form.Item>
        <Form.Item
          name="label"
          label="Label"
          rules={[{ required: true, whitespace: true, message: 'Enter the label' }, { max: 150 }]}
        >
          <Input />
        </Form.Item>
        <Form.Item name="sortOrder" label="Sort order">
          <InputNumber min={0} precision={0} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

/** BO-32: lookup values used in drop-downs; deactivated values are no longer offered. */
export function MasterDataSettings() {
  const categories = useApiQuery<string[]>('/backoffice/config/code-categories');
  const [category, setCategory] = useState<string>();
  const selected = category ?? categories.data?.[0];
  const codes = useApiQuery<CodeItem[]>(selected ? PATH : null, { category: selected });
  const [editing, setEditing] = useState<CodeItem | 'new'>();
  const setActive = useApiMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      api.patch<CodeItem>(`${PATH}/${id}`, { active }),
    {
      success: 'Value updated',
      invalidate: INVALIDATE,
    },
  );

  return (
    <>
      <FilterBar>
        <Select
          aria-label="Category"
          style={{ width: 260 }}
          loading={categories.isLoading}
          value={selected}
          options={(categories.data ?? []).map((value) => ({ value, label: humanise(value) }))}
          onChange={setCategory}
        />
        <span className="filter-bar__spacer" />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={!selected}
          onClick={() => setEditing('new')}
        >
          Add value
        </Button>
      </FilterBar>
      <ErrorAlert error={codes.error ?? setActive.error} className="mb-16" />
      <Card className="content-card">
        <Table<CodeItem>
          size="middle"
          rowKey="id"
          loading={codes.isLoading}
          dataSource={codes.data ?? []}
          pagination={false}
          locale={{ emptyText: 'No values in this category' }}
          columns={[
            { title: 'Code', dataIndex: 'code' },
            { title: 'Label', dataIndex: 'label' },
            { title: 'Sort order', dataIndex: 'sortOrder', align: 'right', width: 110 },
            {
              title: 'Active',
              dataIndex: 'active',
              width: 100,
              render: (active: boolean, item) => (
                <Switch
                  size="small"
                  checked={active}
                  aria-label={`${active ? 'Deactivate' : 'Activate'} ${item.label}`}
                  loading={setActive.isPending && setActive.variables?.id === item.id}
                  onChange={(checked) => setActive.mutate({ id: item.id, active: checked })}
                />
              ),
            },
            {
              key: 'actions',
              width: 80,
              render: (_: unknown, item) => (
                <Button size="small" type="link" onClick={() => setEditing(item)}>
                  Edit
                </Button>
              ),
            },
          ]}
        />
      </Card>
      {editing && selected && (
        <CodeModal
          category={selected}
          item={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </>
  );
}
