import { Card, Flex, Select, Table } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { DocumentOwnerType, DocumentStatus, DocumentView } from '../../api/types';
import { DocumentDownloadButton } from '../../components/admin/DocumentDownloadButton';
import { CellText } from '../../components/admin/CellText';
import { DocumentReviewActions } from '../../components/admin/DocumentReviewActions';
import { recordPath } from '../../components/admin/links';
import { enumOptions, useCodes } from '../../components/admin/useCodes';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { fileSize, formatDate, formatDateTime, humanise } from '../../utils/format';

const STATUSES: DocumentStatus[] = ['UPLOADED', 'VERIFIED', 'REJECTED'];
const OWNER_TYPES: DocumentOwnerType[] = [
  'AGENT',
  'PARTICIPANT',
  'POLICY',
  'PAYMENT',
  'CLAIM',
  'AGENCY',
  'ISSUE',
];

/** BO-11/12: uploaded documents awaiting verification, oldest first. */
export default function DocumentQueuePage() {
  const [status, setStatus] = useState<DocumentStatus>('UPLOADED');
  const [ownerType, setOwnerType] = useState<DocumentOwnerType>();
  const types = useCodes('DOCUMENT_TYPE');
  const documents = usePagedQuery<DocumentView>('/backoffice/documents', { status, ownerType });

  return (
    <>
      <PageHeader
        title="Document checks"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Document checks' }]}
      />
      <FilterBar>
        <Select
          aria-label="Document status"
          style={{ width: 180 }}
          value={status}
          options={enumOptions(STATUSES, (value) =>
            value === 'UPLOADED' ? 'Awaiting verification' : humanise(value),
          )}
          onChange={(value: DocumentStatus) => {
            setStatus(value);
            documents.resetPage();
          }}
        />
        <Select
          allowClear
          placeholder="All record types"
          aria-label="Record type"
          style={{ width: 180 }}
          options={enumOptions(OWNER_TYPES, humanise)}
          onChange={(value?: DocumentOwnerType) => {
            setOwnerType(value);
            documents.resetPage();
          }}
        />
      </FilterBar>
      <Card className="content-card">
        <Table<DocumentView>
          size="middle"
          rowKey="id"
          loading={documents.isFetching}
          dataSource={documents.items}
          pagination={documents.pagination}
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText:
              status === 'UPLOADED'
                ? 'No documents are waiting for verification'
                : 'No documents with this status',
          }}
          columns={[
            { title: 'Uploaded', dataIndex: 'createdAt', render: formatDateTime },
            {
              title: 'Record',
              key: 'owner',
              render: (_: unknown, doc) => {
                const path = recordPath('BACKOFFICE', doc.ownerType, doc.ownerId);
                return path ? (
                  <Link to={path}>Open {humanise(doc.ownerType).toLowerCase()}</Link>
                ) : (
                  humanise(doc.ownerType)
                );
              },
            },
            { title: 'Document type', dataIndex: 'docType', render: types.labelOf },
            {
              title: 'File',
              dataIndex: 'fileName',
              render: (name: string) => <CellText text={name} width={260} />,
            },
            { title: 'Size', dataIndex: 'sizeBytes', render: fileSize },
            {
              title: 'Valid until',
              dataIndex: 'expiryDate',
              render: (value: string | null, doc) =>
                doc.expired ? <StatusTag status="EXPIRED" /> : formatDate(value),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (value: string) => <StatusTag status={value} />,
            },
            {
              title: 'Remarks',
              dataIndex: 'remarks',
              render: (remarks: string | null) => <CellText text={remarks} width={200} />,
            },
            {
              key: 'actions',
              render: (_: unknown, doc) => (
                <Flex gap={4} align="center" className="table-actions">
                  <DocumentDownloadButton documentId={doc.id} fileName={doc.fileName} />
                  <DocumentReviewActions document={doc} />
                </Flex>
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
