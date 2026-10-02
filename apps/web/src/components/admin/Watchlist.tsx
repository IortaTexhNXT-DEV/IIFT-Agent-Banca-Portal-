import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Form,
  Input,
  Modal,
  Switch,
  Typography,
  Upload,
  type UploadFile,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, usePagedQuery } from '../../api/hooks';
import type { WatchlistEntry } from '../../api/admin-types';
import { DataTable, dateTimeColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { ErrorAlert } from '../ErrorAlert';
import { FormSection } from '../FormSection';
import { TableToolbar } from '../TableCard';
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
      width={600}
    >
      <ErrorAlert error={add.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => add.mutate(values)}
        layout="vertical"
        requiredMark="optional"
      >
        <FormSection>
          <Form.Item
            name="listName"
            label="List"
            tooltip="e.g. UN-SANCTIONS, LOCAL-PEP"
            rules={[
              { required: true, whitespace: true, message: 'Enter the list name' },
              { min: 2, max: 50 },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="reference" label="Reference" rules={[{ max: 100 }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="Full name"
            className="field--full"
            rules={[
              { required: true, whitespace: true, message: 'Enter the name' },
              { min: 2, max: 150 },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="idNumber" label="ID number" rules={[{ max: 50 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="country" label="Country" rules={[{ max: 50 }]}>
            <Input />
          </Form.Item>
        </FormSection>
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
      <Form layout="vertical" requiredMark={false}>
        <Form.Item
          label="Header row"
          tooltip="list_name and full_name are required on every line; up to 20,000 entries and 5 MB per file"
        >
          <Typography.Text code copyable>
            {CSV_HEADER}
          </Typography.Text>
        </Form.Item>
        <Form.Item label="File" required>
          <Upload.Dragger
            accept=".csv,text/csv"
            maxCount={1}
            fileList={files}
            beforeUpload={() => false}
            onChange={({ fileList }) => setFiles(fileList.slice(-1))}
          >
            <p className="ant-upload-text">Click or drag a CSV file here</p>
          </Upload.Dragger>
        </Form.Item>
        <Checkbox checked={replaceList} onChange={(event) => setReplaceList(event.target.checked)}>
          Replace the lists in this file
        </Checkbox>
      </Form>
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

  const columns: ColumnsType<WatchlistEntry> = [
    textColumn('List', 'listName', 170),
    textColumn('Full name', 'fullName'),
    textColumn('ID number', 'idNumber', 150),
    textColumn('Country', 'country', 130),
    textColumn('Reference', 'reference', 150),
    dateTimeColumn('Added', 'createdAt', 160),
    {
      title: 'Active',
      dataIndex: 'active',
      width: 80,
      align: 'center',
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
  ];

  return (
    <>
      <TableToolbar
        filters={
          <Input.Search
            allowClear
            placeholder="Name"
            aria-label="Search watch-list names"
            className="filter-search"
            onSearch={(value) => {
              setSearch(value.trim() || undefined);
              entries.resetPage();
            }}
          />
        }
        actions={
          <>
            <Button icon={<UploadOutlined />} onClick={() => setDialog('import')}>
              Import CSV
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog('add')}>
              Add entry
            </Button>
          </>
        }
      />
      {setActive.error && (
        <div className="table-inset">
          <ErrorAlert error={setActive.error} />
        </div>
      )}
      <DataTable<WatchlistEntry>
        rowKey="id"
        loading={entries.isFetching}
        dataSource={entries.items}
        pagination={entries.pagination}
        columns={columns}
        locale={{ emptyText: <EmptyState label="No watch-list entries" /> }}
      />
      {dialog === 'add' && <AddEntryModal onClose={() => setDialog(undefined)} />}
      {dialog === 'import' && <ImportModal onClose={() => setDialog(undefined)} />}
    </>
  );
}
