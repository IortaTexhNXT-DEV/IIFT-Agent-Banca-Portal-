import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Switch,
  Table,
  Typography,
  Upload,
  type UploadFile,
} from 'antd';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { WatchlistEntry } from '../../api/admin-types';
import { formatDateTime } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { FilterBar } from '../FilterBar';
import '../../styles/admin.css';

const PATH = '/backoffice/aml/watchlist';
const CSV_HEADER = 'list_name,full_name,id_number,country,reference';

type EntryValues = Pick<WatchlistEntry, 'listName' | 'fullName'> & {
  idNumber?: string;
  country?: string;
  reference?: string;
};

function AddEntryModal({ onClose }: { onClose(): void }) {
  const [form] = Form.useForm<EntryValues>();
  const add = useApiMutation((values: EntryValues) => api.post<WatchlistEntry>(PATH, values), {
    success: 'Watch-list entry added',
    invalidate: [PATH],
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      title="Add watch-list entry"
      okText="Add"
      okButtonProps={{ loading: add.isPending }}
      onCancel={onClose}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <ErrorAlert error={add.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => add.mutate(values)}
        layout="vertical"
        requiredMark="optional"
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              name="listName"
              label="List"
              extra="e.g. UN-SANCTIONS, LOCAL-PEP"
              rules={[
                { required: true, whitespace: true, message: 'Enter the list name' },
                { min: 2, max: 50 },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="reference" label="Reference" rules={[{ max: 100 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item
              name="fullName"
              label="Full name"
              rules={[
                { required: true, whitespace: true, message: 'Enter the name' },
                { min: 2, max: 150 },
              ]}
            >
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="idNumber" label="ID number" rules={[{ max: 50 }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="country" label="Country" rules={[{ max: 50 }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose(): void }) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [replaceList, setReplaceList] = useState(false);
  const importCsv = useApiMutation(
    () => {
      const data = new FormData();
      data.append('file', files[0].originFileObj as File);
      data.append('replaceList', String(replaceList));
      return api.upload<{ imported: number }>(`${PATH}/import`, data);
    },
    { invalidate: [PATH] },
  );

  return (
    <Modal
      open
      title="Import watch-list (CSV)"
      okText={importCsv.isSuccess ? 'Done' : 'Import'}
      okButtonProps={{ disabled: files.length === 0, loading: importCsv.isPending }}
      onCancel={onClose}
      onOk={() => (importCsv.isSuccess ? onClose() : importCsv.mutate(undefined))}
      destroyOnHidden
    >
      {importCsv.data && (
        <Alert
          className="mb-16"
          type="success"
          showIcon
          title={`${importCsv.data.imported} entries imported`}
        />
      )}
      <ErrorAlert error={importCsv.error} className="mb-16" />
      <Typography.Paragraph>
        The first line of the file must be exactly:
        <br />
        <Typography.Text code copyable>
          {CSV_HEADER}
        </Typography.Text>
      </Typography.Paragraph>
      <Typography.Paragraph type="secondary">
        list_name and full_name are required on every line. Up to 20,000 entries and 5 MB per file.
      </Typography.Paragraph>
      <Upload.Dragger
        accept=".csv,text/csv"
        maxCount={1}
        fileList={files}
        beforeUpload={() => false}
        onChange={({ fileList }) => setFiles(fileList.slice(-1))}
      >
        <p className="ant-upload-text">Click or drag a CSV file here</p>
      </Upload.Dragger>
      <Checkbox
        className="watchlist-replace"
        checked={replaceList}
        onChange={(event) => setReplaceList(event.target.checked)}
      >
        Replace the lists in this file (deactivate their current entries first)
      </Checkbox>
    </Modal>
  );
}

/** BO-13: watch-lists used by the built-in screening, maintained by Compliance. */
export function Watchlist() {
  const [search, setSearch] = useState<string>();
  const [dialog, setDialog] = useState<'add' | 'import'>();
  const entries = usePagedQuery<WatchlistEntry>(PATH, { search });
  const setActive = useApiMutation(
    ({ id, active }: { id: string; active: boolean }) =>
      api.put<WatchlistEntry>(`${PATH}/${id}/active`, { active }),
    {
      success: 'Entry updated',
      invalidate: [PATH],
    },
  );

  return (
    <>
      <FilterBar>
        <Input.Search
          allowClear
          placeholder="Search names"
          aria-label="Search watch-list names"
          style={{ width: 260 }}
          onSearch={(value) => {
            setSearch(value.trim() || undefined);
            entries.resetPage();
          }}
        />
        <span className="filter-bar__spacer" />
        <Button icon={<UploadOutlined />} onClick={() => setDialog('import')}>
          Import CSV
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog('add')}>
          Add entry
        </Button>
      </FilterBar>
      <ErrorAlert error={setActive.error} className="mb-16" />
      <Card className="content-card">
        <Table<WatchlistEntry>
          size="middle"
          rowKey="id"
          loading={entries.isFetching}
          dataSource={entries.items}
          pagination={entries.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No watch-list entries' }}
          columns={[
            { title: 'List', dataIndex: 'listName' },
            { title: 'Full name', dataIndex: 'fullName' },
            {
              title: 'ID number',
              dataIndex: 'idNumber',
              render: (value: string | null) => value ?? '–',
            },
            {
              title: 'Country',
              dataIndex: 'country',
              render: (value: string | null) => value ?? '–',
            },
            {
              title: 'Reference',
              dataIndex: 'reference',
              render: (value: string | null) => value ?? '–',
            },
            { title: 'Added', dataIndex: 'createdAt', render: formatDateTime },
            {
              title: 'Active',
              dataIndex: 'active',
              render: (active: boolean, entry) => (
                <Switch
                  size="small"
                  checked={active}
                  aria-label={`${active ? 'Deactivate' : 'Activate'} ${entry.fullName}`}
                  loading={setActive.isPending && setActive.variables?.id === entry.id}
                  onChange={(checked) => setActive.mutate({ id: entry.id, active: checked })}
                />
              ),
            },
          ]}
        />
      </Card>
      {dialog === 'add' && <AddEntryModal onClose={() => setDialog(undefined)} />}
      {dialog === 'import' && <ImportModal onClose={() => setDialog(undefined)} />}
    </>
  );
}
