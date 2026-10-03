import { EditOutlined } from '@ant-design/icons';
import { Button, Drawer, Form, Input, Switch, Tabs, Tooltip } from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Product } from '../../api/types';
import { JsonField, toJsonText } from '../../components/admin/JsonField';
import { ActionBar } from '../../components/ActionBar';
import { DataTable, textColumn } from '../../components/DataTable';
import { ErrorAlert } from '../../components/ErrorAlert';
import { FormSection } from '../../components/FormSection';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { TableCard } from '../../components/TableCard';
import { formatNumber, humanise } from '../../utils/format';
import '../../styles/admin.css';

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

const SWITCHES: { name: keyof ProductValues; label: string; tooltip: string }[] = [
  { name: 'active', label: 'Offered for sale', tooltip: 'Inactive products cannot be quoted' },
  {
    name: 'paymentBeforeIssuance',
    label: 'Payment before issuance',
    tooltip: 'Otherwise the policy is issued first, with a grace period to pay',
  },
  {
    name: 'allowRenewal',
    label: 'Renewal allowed',
    tooltip: 'Expiring policies are offered for renewal',
  },
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
    {
      success: { title: 'Product saved', description: product.name },
      invalidate: [PATH, '/common/products'],
      onSuccess: onClose,
    },
  );

  return (
    <Drawer
      open
      size={820}
      title={`${product.code} – ${product.name}`}
      onClose={onClose}
      destroyOnHidden
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
        <FormSection title="Product" columns={2}>
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, whitespace: true, message: 'Enter the product name' },
              { min: 3, max: 150, message: '3 to 150 characters' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="Line of business" required>
            <Input value={product.lineOfBusiness} disabled />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
            className="field--full"
            rules={[
              { required: true, whitespace: true, message: 'Enter the description' },
              { min: 3, max: 1000, message: '3 to 1,000 characters' },
            ]}
          >
            <Input.TextArea rows={2} maxLength={1000} showCount />
          </Form.Item>
        </FormSection>
        <FormSection title="Rules" columns={3}>
          {SWITCHES.map((item) => (
            <Form.Item
              key={item.name}
              name={item.name}
              label={item.label}
              tooltip={item.tooltip}
              valuePropName="checked"
              required
            >
              <Switch />
            </Form.Item>
          ))}
        </FormSection>
        <FormSection title="Configuration" columns={1}>
          <Tabs
            size="small"
            items={[
              {
                key: 'config',
                label: 'Rating',
                forceRender: true,
                children: (
                  <JsonField
                    name="config"
                    label="Rating configuration"
                    shape="object"
                    tooltip={`Plans, terms, rates and risk fields read by the ${humanise(product.ratingEngine).toLowerCase()} rating engine`}
                  />
                ),
              },
              {
                key: 'documents',
                label: 'Required documents',
                forceRender: true,
                children: (
                  <JsonField
                    name="requiredDocuments"
                    label="Required documents"
                    shape="array"
                    tooltip='Entries: { "docType": "IC_COPY", "label": "IC copy", "mandatory": true }'
                  />
                ),
              },
              {
                key: 'questionnaire',
                label: 'Questionnaire',
                forceRender: true,
                children: (
                  <JsonField
                    name="questionnaire"
                    label="Questionnaire"
                    shape="array"
                    tooltip='Entries: { "code": "Q1", "text": "…", "referIfYes": true }'
                  />
                ),
              },
            ]}
          />
        </FormSection>
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
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Products' }]}
      />
      <QueryState query={products}>
        {(items) => (
          <TableCard>
            <DataTable<Product>
              rowKey="id"
              scroll={{}}
              pagination={false}
              dataSource={items}
              locale={{ emptyText: 'No products' }}
              onRowClick={setEditing}
              columns={[
                { title: 'Code', dataIndex: 'code', width: 100 },
                textColumn('Name', 'name'),
                { title: 'Line of business', dataIndex: 'lineOfBusiness', width: 150 },
                {
                  title: 'Rating engine',
                  dataIndex: 'ratingEngine',
                  width: 130,
                  render: humanise,
                },
                {
                  title: 'Payment',
                  dataIndex: 'paymentBeforeIssuance',
                  width: 140,
                  render: (before: boolean) => (before ? 'Before issuance' : 'After issuance'),
                },
                {
                  title: 'Renewal',
                  dataIndex: 'allowRenewal',
                  width: 110,
                  render: (allowed: boolean) => (allowed ? 'Allowed' : 'Not allowed'),
                },
                {
                  title: 'Documents',
                  dataIndex: 'requiredDocuments',
                  width: 100,
                  align: 'right',
                  render: (documents: Product['requiredDocuments']) =>
                    formatNumber(documents.length),
                },
                {
                  title: 'Questions',
                  dataIndex: 'questionnaire',
                  width: 90,
                  align: 'right',
                  render: (questions: Product['questionnaire']) => formatNumber(questions.length),
                },
                {
                  title: 'Status',
                  dataIndex: 'active',
                  width: 90,
                  render: (active: boolean) => (
                    <StatusTag status={active ? 'ACTIVE' : 'INACTIVE'} />
                  ),
                },
                {
                  key: 'actions',
                  width: 48,
                  align: 'right',
                  render: (_: unknown, product) => (
                    <Tooltip title="Edit">
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={`Edit ${product.name}`}
                        onClick={() => setEditing(product)}
                      />
                    </Tooltip>
                  ),
                },
              ]}
            />
          </TableCard>
        )}
      </QueryState>
      {editing && <ProductDrawer product={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
