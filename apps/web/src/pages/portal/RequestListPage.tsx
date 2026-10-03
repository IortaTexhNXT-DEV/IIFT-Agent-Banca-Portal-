import { Select } from 'antd';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { ApprovalRequest, ApprovalStatus } from '../../api/types';
import { CellText } from '../../components/admin/CellText';
import { enumOptions } from '../../components/admin/useCodes';
import { DataTable, dateColumn, statusColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';

const STATUSES: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

/** AP-49..51: requests submitted by the user (or their team) and their approval status. */
export default function RequestListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(
    (searchParams.get('status') as ApprovalStatus | null) ?? undefined,
  );
  const requests = usePagedQuery<ApprovalRequest>('/portal/requests', { status });

  return (
    <>
      <PageHeader
        title="My requests"
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'My requests' }]}
      />
      <TableCard
        toolbar={
          <Select
            allowClear
            placeholder="Status"
            aria-label="Status"
            className="filter-select"
            value={status}
            options={enumOptions(STATUSES, humanise)}
            onChange={(value?: ApprovalStatus) => {
              setStatus(value);
              requests.resetPage();
            }}
          />
        }
      >
        <DataTable<ApprovalRequest>
          rowKey="id"
          loading={requests.isFetching}
          dataSource={requests.items}
          pagination={requests.pagination}
          scroll={{}}
          onRowClick={(request) => navigate(`/portal/requests/${request.id}`)}
          locale={{ emptyText: <EmptyState label="No requests yet" /> }}
          columns={[
            {
              title: 'Request no.',
              dataIndex: 'requestNo',
              width: 130,
              render: (no: string, row) => <Link to={`/portal/requests/${row.id}`}>{no}</Link>,
            },
            { title: 'Type', dataIndex: 'type', width: 170, ellipsis: true, render: humanise },
            textColumn('Summary', 'summary'),
            statusColumn('Status', 'status', 115),
            textColumn('Submitted by', 'makerName', 150),
            dateColumn('Submitted', 'submittedAt', 110),
            dateColumn('Decided', 'decidedAt', 110),
            {
              title: 'Remarks',
              dataIndex: 'finalRemarks',
              width: 180,
              render: (remarks: string | null, row) => (
                <CellText
                  text={remarks}
                  width={150}
                  type={row.status === 'REJECTED' ? 'danger' : undefined}
                />
              ),
            },
          ]}
        />
      </TableCard>
    </>
  );
}
