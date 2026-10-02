import { UploadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  DatePicker,
  Flex,
  Form,
  Modal,
  Select,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import type { UploadFile } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Channel, DocumentView } from '../../api/types';
import { formatDate } from '../../utils/format';
import { DataTable, dateColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { ErrorAlert } from '../ErrorAlert';
import { StatusTag } from '../StatusTag';
import { DocumentDownloadButton } from './DocumentDownloadButton';
import { DocumentReviewActions } from './DocumentReviewActions';
import { useCodes } from './useCodes';

/** Document types collected for agents and bank officers; an IC copy is needed for approval. */
const AGENT_DOCUMENT_TYPES = ['IC_COPY', 'PASSPORT_COPY', 'AGENT_LICENCE', 'PHOTO', 'OTHER'];
const BANCA_DOCUMENT_TYPES = ['IC_COPY', 'PASSPORT_COPY', 'BANK_AUTHORISATION', 'PHOTO', 'OTHER'];
const EXPIRY_WARNING_DAYS = 30;
const ACCEPT = '.pdf,.png,.jpg,.jpeg';

interface Props {
  agentId: string;
  channel: Channel;
  canUpload?: boolean;
  canReview?: boolean;
  /** Passport holders must provide a passport copy, everyone else an IC copy. */
  idType?: string;
  /** Warn while the mandatory identity document is missing (pending registrations). */
  checkRequired?: boolean;
  /** Section heading; omit when the surrounding tab or card already names the list. */
  title?: string;
}

/** Validity date with an "Expired" or "Expires soon" marker. */
export function ExpiryCell({ document }: { document: DocumentView }) {
  if (!document.expiryDate) return <span className="muted">–</span>;
  const soon =
    !document.expired && dayjs(document.expiryDate).diff(dayjs(), 'day') <= EXPIRY_WARNING_DAYS;
  return (
    <Flex gap={6} align="center">
      {formatDate(document.expiryDate)}
      {document.expired && <StatusTag status="EXPIRED" />}
      {soon && (
        <Tag color="orange" variant="filled" className="status-tag">
          Expires soon
        </Tag>
      )}
    </Flex>
  );
}

/** Status chip; rejection or verification remarks are shown in the tooltip. */
export function DocumentStatusCell({ document }: { document: DocumentView }) {
  const tag = <StatusTag status={document.status} />;
  return document.remarks ? (
    <Tooltip title={document.remarks}>
      <span>{tag}</span>
    </Tooltip>
  ) : (
    tag
  );
}

/**
 * AP-46/47, BO-11: documents of an agent or bank officer with status, validity and
 * expiry; optional upload (with expiry date) and verification.
 */
export function AgentDocuments({
  agentId,
  channel,
  canUpload = false,
  canReview = false,
  idType,
  checkRequired = false,
  title,
}: Props) {
  const requiredType = idType === 'PASSPORT' ? 'PASSPORT_COPY' : 'IC_COPY';
  const [uploading, setUploading] = useState(false);
  const documents = useApiQuery<DocumentView[]>('/common/documents', {
    ownerType: 'AGENT',
    ownerId: agentId,
  });
  const types = useCodes('DOCUMENT_TYPE');
  const items = documents.data ?? [];
  const missingRequired =
    checkRequired &&
    !documents.isLoading &&
    !items.some((doc) => doc.docType === requiredType && doc.status !== 'REJECTED');

  const columns: ColumnsType<DocumentView> = [
    { title: 'Type', dataIndex: 'docType', width: 130, render: types.labelOf },
    textColumn('File', 'fileName'),
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (_: unknown, doc) => <DocumentStatusCell document={doc} />,
    },
    {
      title: 'Valid until',
      dataIndex: 'expiryDate',
      width: 160,
      render: (_: unknown, doc) => <ExpiryCell document={doc} />,
    },
    dateColumn('Added', 'createdAt', 110),
    {
      key: 'actions',
      width: canReview ? 140 : 56,
      align: 'right',
      render: (_: unknown, doc) => (
        <Flex gap={4} align="center" justify="flex-end" className="table-actions">
          {canReview && <DocumentReviewActions document={doc} />}
          <DocumentDownloadButton documentId={doc.id} fileName={doc.fileName} />
        </Flex>
      ),
    },
  ];

  return (
    <>
      {(title || canUpload) && (
        <Flex
          justify={title ? 'space-between' : 'flex-end'}
          align="center"
          className="section-title"
        >
          {title && <Typography.Title level={5}>{title}</Typography.Title>}
          {canUpload && (
            <Button icon={<UploadOutlined />} onClick={() => setUploading(true)}>
              Upload
            </Button>
          )}
        </Flex>
      )}
      {missingRequired && (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title={`${types.labelOf(requiredType)} required before approval`}
        />
      )}
      <ErrorAlert error={documents.error} className="mb-16" />
      <DataTable<DocumentView>
        size="small"
        rowKey="id"
        loading={documents.isLoading}
        dataSource={items}
        pagination={false}
        scroll={{}}
        columns={columns}
        locale={{ emptyText: <EmptyState label="No documents" /> }}
      />
      {uploading && (
        <UploadDialog
          agentId={agentId}
          options={(channel === 'BANCA' ? BANCA_DOCUMENT_TYPES : AGENT_DOCUMENT_TYPES).map(
            (type) => ({
              value: type,
              label: `${types.labelOf(type)}${type === requiredType ? ' (required)' : ''}`,
            }),
          )}
          onClose={() => setUploading(false)}
        />
      )}
    </>
  );
}

interface UploadValues {
  docType: string;
  expiryDate?: Dayjs;
}

function UploadDialog({
  agentId,
  options,
  onClose,
}: {
  agentId: string;
  options: { value: string; label: string }[];
  onClose(): void;
}) {
  const [form] = Form.useForm<UploadValues>();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const upload = useApiMutation(
    (values: UploadValues) => {
      const data = new FormData();
      data.append('ownerType', 'AGENT');
      data.append('ownerId', agentId);
      data.append('docType', values.docType);
      if (values.expiryDate) data.append('expiryDate', values.expiryDate.format('YYYY-MM-DD'));
      data.append('file', files[0].originFileObj as File);
      return api.upload<DocumentView>('/common/documents', data);
    },
    {
      success: 'Document uploaded',
      invalidate: ['/common/documents', '/portal', '/backoffice'],
      onSuccess: onClose,
    },
  );

  return (
    <Modal
      open
      title="Upload document"
      okText="Upload"
      onCancel={onClose}
      okButtonProps={{ disabled: files.length === 0, loading: upload.isPending }}
      onOk={() => form.submit()}
      destroyOnHidden
    >
      <ErrorAlert error={upload.error} className="mb-16" />
      <Form
        form={form}
        onFinish={(values) => upload.mutate(values)}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item
          name="docType"
          label="Document type"
          rules={[{ required: true, message: 'Choose the document type' }]}
        >
          <Select options={options} />
        </Form.Item>
        <Form.Item
          name="expiryDate"
          label="Valid until"
          tooltip="For licences, passports and other documents with an expiry date"
        >
          <DatePicker
            format="DD MMM YYYY"
            disabledDate={(date) => date.isBefore(dayjs(), 'day')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="File" tooltip="PDF, PNG or JPEG, up to 10 MB" required>
          <Upload.Dragger
            accept={ACCEPT}
            maxCount={1}
            fileList={files}
            beforeUpload={() => false}
            onChange={({ fileList }) => setFiles(fileList.slice(-1))}
          >
            <p className="ant-upload-text">Click or drag a file here</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
