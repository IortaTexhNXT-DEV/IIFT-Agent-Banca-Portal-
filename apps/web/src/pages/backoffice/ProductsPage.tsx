import { Button, Card, Col, Drawer, Flex, Form, Input, Row, Switch, Table, Tabs } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Product } from '../../api/types';
import { JsonField, toJsonText } from '../../components/admin/JsonField';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { humanise } from '../../utils/format';

const PATH = '/backoffice/products';

interface ProductValues {
  name: string;
  description: string;
  active: boolean;
  paymentBeforeIssuance: boolean;
  allowRenewal: boolean;
  config: string;
  requiredDocuments: string;
  questionnaire: string;
}

const SWITCHES: { name: keyof ProductValues; label: string; extra: string }[] = [
  { name: 'active', label: 'Offered for sale', extra: 'Inactive products cannot be quoted' },
  { name: 'paymentBeforeIssuance', label: 'Payment before issuance', extra: 'Otherwise the policy is issued first, with a grace period to pay' },
  { name: 'allowRenewal', label: 'Renewal allowed', extra: 'Expiring policies are offered for renewal' },
];

function ProductDrawer({ product, onClose }: { product: Product; onClose(): void }) {
  const [form] = Form.useForm<ProductValues>();
  const save = useApiMutation(
    (values: ProductValues) =>
      api.put<Product>(`${PATH}/${product.id}`, {
        name: values.name.trim(),
        description: values.description.trim(),
        active: values.active,
        paymentBeforeIssuance: values.paymentBeforeIssuance,
        allowRenewal: values.allowRenewal,
        config: JSON.parse(values.config) as unknown,
        requiredDocuments: JSON.parse(values.requiredDocuments) as unknown,
        questionnaire: JSON.parse(values.questionnaire) as unknown,
      }),
    { success: `${product.name} saved`, invalidate: [PATH, '/common/products'], onSuccess: onClose },
  );

  return (
    <Drawer
      open
      size={820}
      title={`${product.code} – ${product.name}`}
      onClose={onClose}
      destroyOnHidden
      extra={
        <Flex gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" loading={save.isPending} onClick={() => form.validateFields().then((values) => save.mutate(values))}>
            Save
          </Button>
        </Flex>
      }
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          name: product.name,
          description: product.description,
          active: product.active,
          paymentBeforeIssuance: product.paymentBeforeIssuance,
          allowRenewal: product.allowRenewal,
          config: toJsonText(product.config),
          requiredDocuments: toJsonText(product.requiredDocuments),
          questionnaire: toJsonText(product.questionnaire),
        }}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true }, { min: 3, max: 150 }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Description" rules={[{ required: true, whitespace: true }, { min: 3, max: 1000 }]}>
          <Input.TextArea rows={3} maxLength={1000} showCount />
        </Form.Item>
        <Row gutter={16}>
          {SWITCHES.map((item) => (
            <Col key={item.name} xs={24} md={8}>
              <Form.Item name={item.name} label={item.label} extra={item.extra} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          ))}
        </Row>
        <Tabs
          items={[
            {
              key: 'config',
              label: 'Rating configuration',
              forceRender: true,
              children: <JsonField name="config" label="Configuration" shape="object" rows={20} extra={`Plans, terms, rates and risk fields read by the ${humanise(product.ratingEngine).toLowerCase()} rating engine`} />,
            },
            {
              key: 'documents',
              label: 'Required documents',
              forceRender: true,
              children: <JsonField name="requiredDocuments" label="Required documents" shape="array" extra='Each entry: { "docType": "IC_COPY", "label": "IC copy", "mandatory": true }' />,
            },
            {
              key: 'questionnaire',
              label: 'Questionnaire',
              forceRender: true,
              children: <JsonField name="questionnaire" label="Questionnaire" shape="array" extra='Each entry: { "code": "Q1", "text": "…", "referIfYes": true }' />,
            },
          ]}
        />
      </Form>
    </Drawer>
  );
}

/** BO-33: product parameters, rating configuration, documents and declarations without code changes. */
export default function ProductsPage() {
  const products = useApiQuery<Product[]>(PATH);
  const [editing, setEditing] = useState<Product>();

  return (
    <>
      <PageHeader
        title="Products"
        subtitle="Takaful products offered through the portal and their rating rules"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Products' }]}
      />
      <Card className="content-card">
        <QueryState query={products}>
          {(items) => (
            <Table<Product>
              size="middle"
              rowKey="id"
              pagination={false}
              dataSource={items}
              scroll={{ x: 'max-content' }}
              columns={[
                { title: 'Code', dataIndex: 'code' },
                { title: 'Name', dataIndex: 'name' },
                { title: 'Line of business', dataIndex: 'lineOfBusiness' },
                { title: 'Rating engine', dataIndex: 'ratingEngine', render: humanise },
                { title: 'Payment', dataIndex: 'paymentBeforeIssuance', render: (before: boolean) => (before ? 'Before issuance' : 'After issuance (grace)') },
                { title: 'Renewal', dataIndex: 'allowRenewal', render: (allowed: boolean) => (allowed ? 'Allowed' : 'Not allowed') },
                { title: 'Documents', dataIndex: 'requiredDocuments', align: 'right', render: (documents: Product['requiredDocuments']) => documents.length },
                { title: 'Status', dataIndex: 'active', render: (active: boolean) => <StatusTag status={active ? 'ACTIVE' : 'INACTIVE'} /> },
                {
                  key: 'actions',
                  render: (_: unknown, product) => (
                    <Button size="small" type="link" onClick={() => setEditing(product)}>
                      Edit
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </QueryState>
      </Card>
      {editing && <ProductDrawer product={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
