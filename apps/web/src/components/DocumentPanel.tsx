import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Flex, Form, Modal, Select, Tooltip, Typography, Upload } from 'antd';
import type { UploadFile } from 'antd';
import { useState } from 'react';
import { api, download } from '../api/client';
import { useApiMutation, useApiQuery } from '../api/hooks';
import type { CodeItem, DocumentOwnerType, DocumentView, RequiredDocument } from '../api/types';
import { fileSize } from '../utils/format';
import { DataTable, dateTimeColumn, textColumn } from './DataTable';
import { EmptyState } from './EmptyState';
import { ErrorAlert } from './ErrorAlert';
import { StatusTag } from './StatusTag';

interface Props {
  ownerType: DocumentOwnerType;
  ownerId: string;
  /** Document types to offer for upload; defaults to every active document type. */
  uploadTypes?: RequiredDocument[];
  canUpload?: boolean;
  title?: string;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg';

/**
 * Lists the documents attached to a record, with download and (optionally) upload.
 * Files are validated by the server (type by content, size, malware scan).
 */
export function DocumentPanel({
  ownerType,
  ownerId,
  uploadTypes,
  canUpload = false,
  title = 'Documents',
}: Props) {
  const [open, setOpen] = useState(false);
  const documents = useApiQuery<DocumentView[]>('/common/documents', { ownerType, ownerId });
  const codes = useApiQuery<CodeItem[]>(uploadTypes ? null : '/common/codes', {
    category: 'DOCUMENT_TYPE',
  });
  const labels = new Map((codes.data ?? []).map((code) => [code.code, code.label]));
  uploadTypes?.forEach((type) => labels.set(type.docType, type.label));

  return (
    <>
      <Flex justify="space-between" align="center" className="section-title">
        <Typography.Title level={5}>{title}</Typography.Title>
        {canUpload && (
          <Button icon={<UploadOutlined />} onClick={() => setOpen(true)}>
            Upload
          </Button>
        )}
      </Flex>
      <DataTable<DocumentView>
        size="small"
        rowKey="id"
        loading={documents.isLoading}
        dataSource={documents.data ?? []}
        pagination={false}
        scroll={{}}
        locale={{ emptyText: <EmptyState label="No documents yet" /> }}
        columns={[
          {
            title: 'Type',
            dataIndex: 'docType',
            width: 150,
            ellipsis: true,
            render: (type: string) => labels.get(type) ?? type,
          },
          textColumn('File', 'fileName'),
          { title: 'Size', dataIndex: 'sizeBytes', width: 80, align: 'right', render: fileSize },
          {
            title: 'Status',
            dataIndex: 'status',
            width: 130,
            className: 'cell-nowrap',
            render: (_: unknown, doc) =>
              doc.expired ? (
                <StatusTag status="EXPIRED" />
              ) : (
                <StatusTag
                  status={doc.systemGenerated ? 'COMPLETED' : doc.status}
                  label={doc.systemGenerated ? 'Issued' : undefined}
                />
              ),
          },
          dateTimeColumn('Added', 'createdAt', 150),
          {
            key: 'download',
            width: 56,
            render: (_: unknown, doc) => (
              <Tooltip title="Download">
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  aria-label={`Download ${doc.fileName}`}
                  onClick={() => void download(`/common/documents/${doc.id}/content`)}
                />
              </Tooltip>
            ),
          },
        ]}
      />
      {open && (
        <UploadDialog
          ownerType={ownerType}
          ownerId={ownerId}
          types={
            uploadTypes ??
            (codes.data ?? []).map((code) => ({
              docType: code.code,
              label: code.label,
              mandatory: false,
            }))
          }
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

interface DialogProps {
  ownerType: DocumentOwnerType;
  ownerId: string;
  types: RequiredDocument[];
  onClose(): void;
}

function UploadDialog({ ownerType, ownerId, types, onClose }: DialogProps) {
  const [form] = Form.useForm<{ docType: string }>();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const upload = useApiMutation(
    (values: { docType: string }) => {
      const data = new FormData();
      data.append('ownerType', ownerType);
      data.append('ownerId', ownerId);
      data.append('docType', values.docType);
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
      onOk={() => form.validateFields().then((values) => upload.mutate(values))}
      destroyOnHidden
    >
      <ErrorAlert error={upload.error} className="mb-16" />
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="docType"
          label="Document type"
          rules={[{ required: true, message: 'Choose the document type' }]}
        >
          <Select
            showSearch={{ optionFilterProp: 'label' }}
            options={types.map((type) => ({
              value: type.docType,
              label: `${type.label}${type.mandatory ? ' (required)' : ''}`,
            }))}
          />
        </Form.Item>
        <Form.Item label="File" extra="PDF, PNG or JPEG, up to 10 MB" required>
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
