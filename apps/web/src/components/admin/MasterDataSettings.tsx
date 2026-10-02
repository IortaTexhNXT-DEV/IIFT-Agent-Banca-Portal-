import { EditOutlined, PlusOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Switch, Tooltip } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { CodeItem } from '../../api/types';
import { humanise } from '../../utils/format';
import { DataTable, textColumn } from '../DataTable';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { QueryState } from '../QueryState';
import { TableCard } from '../TableCard';
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
      width={480}
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
        <FormSection columns={2}>
          <Form.Item
            name="code"
            label="Code"
            tooltip={item ? 'Codes cannot be changed once in use' : 'Stored on records'}
            rules={[
              { required: true, message: 'Enter a code' },
              { pattern: CODE_PATTERN, message: 'Up to 50 letters, digits or underscores' },
            ]}
          >
            <Input disabled={Boolean(item)} />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort order">
            <InputNumber min={0} precision={0} className="w-full" />
          </Form.Item>
          <Form.Item
            name="label"
            label="Label"
            className="field--full"
            rules={[{ required: true, whitespace: true, message: 'Enter the label' }, { max: 150 }]}
          >
            <Input />
          </Form.Item>
        </FormSection>
      </Form>
    </Modal>
  );
}

function CategoryList({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected?: string;
  onSelect(category: string): void;
}) {
  return (
    <ul className="side-list">
      {categories.map((category) => (
        <li key={category}>
          <button
            type="button"
            className={`side-list__item${category === selected ? ' side-list__item--active' : ''}`}
            aria-current={category === selected ? 'true' : undefined}
            onClick={() => onSelect(category)}
          >
            <span>{humanise(category)}</span>
            <RightOutlined className="muted" />
          </button>
        </li>
      ))}
    </ul>
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
      <ErrorAlert error={codes.error ?? setActive.error} className="mb-16" />
      <Row gutter={16}>
        <Col xs={24} md={8} xl={6}>
          <Card title="Code lists" className="content-card content-card--flush">
            <QueryState query={categories} rows={6}>
              {(items) => (
                <CategoryList categories={items} selected={selected} onSelect={setCategory} />
              )}
            </QueryState>
          </Card>
        </Col>
        <Col xs={24} md={16} xl={18}>
          <TableCard
            title={selected ? humanise(selected) : 'Values'}
            extra={
              <Button
                size="small"
                icon={<PlusOutlined />}
                disabled={!selected}
                onClick={() => setEditing('new')}
              >
                Add value
              </Button>
            }
          >
            <DataTable<CodeItem>
              size="small"
              rowKey="id"
              scroll={{}}
              loading={codes.isLoading}
              dataSource={codes.data ?? []}
              pagination={false}
              locale={{ emptyText: 'No values' }}
              columns={[
                { title: 'Code', dataIndex: 'code', width: 200 },
                textColumn('Label', 'label'),
                { title: 'Sort order', dataIndex: 'sortOrder', align: 'right', width: 100 },
                {
                  title: 'Active',
                  dataIndex: 'active',
                  width: 80,
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
                  width: 56,
                  align: 'right',
                  render: (_: unknown, item) => (
                    <Tooltip title="Edit">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={`Edit ${item.label}`}
                        onClick={() => setEditing(item)}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />
          </TableCard>
        </Col>
      </Row>
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
