import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Flex, Form, Modal, Select, Table, Tag, Tooltip, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api, download } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { Channel, DocumentView } from '../../api/types';
import { fileSize, formatDate, formatDateTime } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { StatusTag } from '../StatusTag';
import { DocumentReviewActions } from './DocumentReviewActions';
import { useCodes } from './useCodes';

/** Document types collected for agents and bank officers; an IC copy is needed for approval. */
const REQUIRED_TYPE = 'IC_COPY';
const AGENT_DOCUMENT_TYPES = ['IC_COPY', 'PASSPORT_COPY', 'AGENT_LICENCE', 'PHOTO', 'OTHER'];
const BANCA_DOCUMENT_TYPES = ['IC_COPY', 'PASSPORT_COPY', 'BANK_AUTHORISATION', 'PHOTO', 'OTHER'];
const EXPIRY_WARNING_DAYS = 30;
const ACCEPT = '.pdf,.png,.jpg,.jpeg';

interface Props {
  agentId: string;
  channel: Channel;
  canUpload?: boolean;
  canReview?: boolean;
  /** Warn while the mandatory IC copy is missing (pending registrations). */
  checkRequired?: boolean;
  /** Section heading; omit when the surrounding tab or card already names the list. */
  title?: string;
}

function ExpiryCell({ document }: { document: DocumentView }) {
  if (!document.expiryDate) return <span className="muted">–</span>;
  const soon = !document.expired && dayjs(document.expiryDate).diff(dayjs(), 'day') <= EXPIRY_WARNING_DAYS;
  return (
    <Flex gap={6} align="center">
      {formatDate(document.expiryDate)}
      {document.expired && <StatusTag status="EXPIRED" />}
      {soon && (
        <Tag color="orange" variant="filled">
          Expires soon
        </Tag>
      )}
    </Flex>
  );
}

/**
 * AP-46/47, BO-11: documents of an agent or bank officer with status, validity and
 * expiry; optional upload (with expiry date) and verification.
 */
export function AgentDocuments({ agentId, channel, canUpload = false, canReview = false, checkRequired = false, title }: Props) {
  const [uploading, setUploading] = useState(false);
  const documents = useApiQuery<DocumentView[]>('/common/documents', { ownerType: 'AGENT', ownerId: agentId });
  const types = useCodes('DOCUMENT_TYPE');
  const items = documents.data ?? [];
  const missingRequired = checkRequired && !documents.isLoading && !items.some((doc) => doc.docType === REQUIRED_TYPE && doc.status !== 'REJECTED');

  return (
    <>
      {(title || canUpload) && (
        <Flex justify={title ? 'space-between' : 'flex-end'} align="center" className="section-title">
          {title && <Typography.Title level={5}>{title}</Typography.Title>}
          {canUpload && (
            <Button icon={<UploadOutlined />} onClick={() => setUploading(true)}>
              Upload
            </Button>
          )}
        </Flex>
      )}
      {missingRequired && <Alert className="mb-16" type="warning" showIcon title={`${types.labelOf(REQUIRED_TYPE)} is required before IIFT can approve the registration`} />}
      <ErrorAlert error={documents.error} className="mb-16" />
      <Table<DocumentView>
        size="small"
        rowKey="id"
        loading={documents.isLoading}
        dataSource={items}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'No documents yet' }}
        columns={[
          { title: 'Type', dataIndex: 'docType', render: types.labelOf },
          { title: 'File', dataIndex: 'fileName', ellipsis: true },
          { title: 'Size', dataIndex: 'sizeBytes', width: 80, render: fileSize },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 120,
            render: (_: unknown, doc) => (
              <Tooltip title={doc.remarks}>
                <span>
                  <StatusTag status={doc.status} />
                </span>
              </Tooltip>
            ),
          },
          { title: 'Expiry', dataIndex: 'expiryDate', render: (_: unknown, doc) => <ExpiryCell document={doc} /> },
          { title: 'Added', dataIndex: 'createdAt', width: 170, render: formatDateTime },
          {
            key: 'actions',
            render: (_: unknown, doc) => (
              <Flex gap={4} align="center" className="table-actions">
                <Tooltip title="Download">
                  <Button type="text" icon={<DownloadOutlined />} aria-label={`Download ${doc.fileName}`} onClick={() => void download(`/common/documents/${doc.id}/content`)} />
                </Tooltip>
                {canReview && <DocumentReviewActions document={doc} />}
              </Flex>
            ),
          },
        ]}
      />
      {uploading && (
        <UploadDialog
          agentId={agentId}
          options={(channel === 'BANCA' ? BANCA_DOCUMENT_TYPES : AGENT_DOCUMENT_TYPES).map((type) => ({
            value: type,
            label: `${types.labelOf(type)}${type === REQUIRED_TYPE ? ' (required)' : ''}`,
          }))}
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

function UploadDialog({ agentId, options, onClose }: { agentId: string; options: { value: string; label: string }[]; onClose(): void }) {
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
    { success: 'Document uploaded', invalidate: ['/common/documents', '/portal', '/backoffice'], onSuccess: onClose },
  );

  return (
    <Modal
      open
      title="Upload document"
      okText="Upload"
      onCancel={onClose}
      okButtonProps={{ disabled: files.length === 0, loading: upload.isPending }}
      onOk={() => form.validateFields().then((values) => upload.mutate(values))}
      destroyOnHidden
    >
      <ErrorAlert error={upload.error} className="mb-16" />
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item name="docType" label="Document type" rules={[{ required: true, message: 'Choose the document type' }]}>
          <Select options={options} />
        </Form.Item>
        <Form.Item name="expiryDate" label="Valid until" extra="For licences, passports and other documents with an expiry date">
          <DatePicker format="DD MMM YYYY" disabledDate={(date) => date.isBefore(dayjs(), 'day')} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="File" extra="PDF, PNG or JPEG, up to 10 MB" required>
          <Upload.Dragger accept={ACCEPT} maxCount={1} fileList={files} beforeUpload={() => false} onChange={({ fileList }) => setFiles(fileList.slice(-1))}>
            <p className="ant-upload-text">Click or drag a file here</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
