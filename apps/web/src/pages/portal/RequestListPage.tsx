import { Card, Select, Table } from 'antd';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { ApprovalRequest, ApprovalStatus } from '../../api/types';
import { CellText } from '../../components/admin/CellText';
import { enumOptions } from '../../components/admin/useCodes';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { StatusTag } from '../../components/StatusTag';
import { formatDateTime, humanise } from '../../utils/format';

const STATUSES: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

/** AP-49..51: requests submitted by the user (or their team) and their approval status. */
export default function RequestListPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(
    (searchParams.get('status') as ApprovalStatus | null) ?? undefined,
  );
  const requests = usePagedQuery<ApprovalRequest>('/portal/requests', { status });

  return (
    <>
      <PageHeader
        title="My requests"
        subtitle="Registrations, changes, cancellations and payments sent to IIFT for approval"
        breadcrumb={[{ title: 'Dashboard', to: '/portal' }, { title: 'My requests' }]}
      />
      <FilterBar>
        <Select
          allowClear
          placeholder="All statuses"
          aria-label="Status"
          style={{ width: 180 }}
          value={status}
          options={enumOptions(STATUSES, humanise)}
          onChange={(value?: ApprovalStatus) => {
            setStatus(value);
            requests.resetPage();
          }}
        />
      </FilterBar>
      <Card className="content-card">
        <Table<ApprovalRequest>
          size="middle"
          rowKey="id"
          loading={requests.isFetching}
          dataSource={requests.items}
          pagination={requests.pagination}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: 'No requests found' }}
          columns={[
            {
              title: 'Request no.',
              dataIndex: 'requestNo',
              render: (no: string, row) => <Link to={`/portal/requests/${row.id}`}>{no}</Link>,
            },
            { title: 'Type', dataIndex: 'type', render: humanise },
            {
              title: 'Summary',
              dataIndex: 'summary',
              render: (summary: string) => <CellText text={summary} />,
            },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (value: string) => <StatusTag status={value} />,
            },
            { title: 'Submitted by', dataIndex: 'makerName' },
            { title: 'Submitted', dataIndex: 'submittedAt', render: formatDateTime },
            { title: 'Decided', dataIndex: 'decidedAt', render: formatDateTime },
            {
              title: 'Remarks',
              dataIndex: 'finalRemarks',
              render: (remarks: string | null, row) => (
                <CellText
                  text={remarks}
                  width={260}
                  type={row.status === 'REJECTED' ? 'danger' : undefined}
                />
              ),
            },
          ]}
        />
      </Card>
    </>
  );
}
