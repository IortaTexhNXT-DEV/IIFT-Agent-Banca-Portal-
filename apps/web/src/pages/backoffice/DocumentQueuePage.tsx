import { Flex, Select, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { DocumentOwnerType, DocumentStatus, DocumentView } from '../../api/types';
import { DocumentStatusCell, ExpiryCell } from '../../components/admin/AgentDocuments';
import { DocumentDownloadButton } from '../../components/admin/DocumentDownloadButton';
import { DocumentReviewActions } from '../../components/admin/DocumentReviewActions';
import { recordPath } from '../../components/admin/links';
import { enumOptions, useCodes } from '../../components/admin/useCodes';
import { DataTable, dateTimeColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { fileSize, humanise } from '../../utils/format';

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

  const reviewable = status === 'UPLOADED';
  const columns: ColumnsType<DocumentView> = [
    dateTimeColumn('Uploaded', 'createdAt', 160),
    {
      title: 'Record',
      key: 'owner',
      width: 110,
      render: (_: unknown, doc) => {
        const path = recordPath('BACKOFFICE', doc.ownerType, doc.ownerId);
        const label = humanise(doc.ownerType);
        return path ? <Link to={path}>{label}</Link> : label;
      },
    },
    {
      title: 'Document type',
      dataIndex: 'docType',
      width: 160,
      ellipsis: { showTitle: false },
      render: (type: string) => (
        <Tooltip title={types.labelOf(type)} placement="topLeft">
          {types.labelOf(type)}
        </Tooltip>
      ),
    },
    textColumn('File', 'fileName'),
    { title: 'Size', dataIndex: 'sizeBytes', width: 70, align: 'right', render: fileSize },
    {
      title: 'Valid until',
      dataIndex: 'expiryDate',
      width: 150,
      render: (_: unknown, doc) => <ExpiryCell document={doc} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (_: unknown, doc) => <DocumentStatusCell document={doc} />,
    },
    ...(reviewable ? [] : [textColumn<DocumentView>('Remarks', 'remarks', 150)]),
    {
      key: 'actions',
      width: reviewable ? 150 : 56,
      align: 'right',
      render: (_: unknown, doc) => (
        <Flex gap={4} align="center" justify="flex-end" className="table-actions">
          <DocumentReviewActions document={doc} />
          <DocumentDownloadButton documentId={doc.id} fileName={doc.fileName} />
        </Flex>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Document checks"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Document checks' }]}
      />
      <TableCard
        toolbar={
          <>
            <Select
              aria-label="Document status"
              className="filter-select filter-select--wide"
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
              placeholder="Record type"
              aria-label="Record type"
              className="filter-select"
              options={enumOptions(OWNER_TYPES, humanise)}
              onChange={(value?: DocumentOwnerType) => {
                setOwnerType(value);
                documents.resetPage();
              }}
            />
          </>
        }
      >
        <DataTable<DocumentView>
          rowKey="id"
          loading={documents.isFetching}
          dataSource={documents.items}
          pagination={documents.pagination}
          columns={columns}
          locale={{
            emptyText: (
              <EmptyState
                label={
                  status === 'UPLOADED' ? 'No documents awaiting verification' : 'No documents'
                }
              />
            ),
          }}
        />
      </TableCard>
    </>
  );
}
