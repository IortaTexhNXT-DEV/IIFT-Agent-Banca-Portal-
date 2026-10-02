import { DatePicker, Input, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router';
import { useApiQuery, usePagedQuery } from '../../api/hooks';
import type { AuditFacets, AuditRecord } from '../../api/admin-types';
import { ChangeTable } from '../../components/admin/ChangeTable';
import { recordPath } from '../../components/admin/links';
import { DataTable, dateTimeColumn, textColumn } from '../../components/DataTable';
import { EmptyState } from '../../components/EmptyState';
import { FieldGrid } from '../../components/FieldGrid';
import { PageHeader } from '../../components/PageHeader';
import { TableCard } from '../../components/TableCard';
import { humanise } from '../../utils/format';
import '../../styles/admin.css';

interface Filters {
  from?: string;
  to?: string;
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
}

function AuditChange({ record }: { record: AuditRecord }) {
  return (
    <div className="audit-change">
      <ChangeTable before={record.before} after={record.after} />
      <FieldGrid
        columns={2}
        className="audit-meta"
        items={[
          { key: 'agent', label: 'Browser / client', value: record.userAgent },
          { key: 'correlation', label: 'Correlation id', value: record.correlationId },
        ]}
      />
    </div>
  );
}

const renderAuditChange = (record: AuditRecord) => <AuditChange record={record} />;
const facetOptions = (values: string[] | undefined) =>
  (values ?? []).map((value) => ({ value, label: humanise(value) }));

/** BO-26..28: search the append-only audit trail and inspect before/after values. */
export default function AuditPage() {
  const [filters, setFilters] = useState<Filters>({});
  const facets = useApiQuery<AuditFacets>('/backoffice/audit/facets');
  const records = usePagedQuery<AuditRecord>('/backoffice/audit', { ...filters });
  const update = (changes: Filters) => {
    setFilters((current) => ({ ...current, ...changes }));
    records.resetPage();
  };

  const columns: ColumnsType<AuditRecord> = [
    dateTimeColumn('When', 'occurredAt', 160),
    textColumn('User', 'actorName', 150),
    { title: 'Action', dataIndex: 'action', width: 200, ellipsis: true, render: humanise },
    { title: 'Record type', dataIndex: 'entityType', width: 140, ellipsis: true },
    {
      title: 'Record id',
      dataIndex: 'entityId',
      ellipsis: true,
      className: 'audit-id',
      render: (entityId: string | null, record) => {
        const path = recordPath('BACKOFFICE', record.entityType, entityId);
        return path ? <Link to={path}>{entityId}</Link> : (entityId ?? '–');
      },
    },
    textColumn('IP address', 'ipAddress', 140),
  ];

  return (
    <>
      <PageHeader
        title="Audit trail"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Audit trail' }]}
      />
      <TableCard
        toolbar={
          <>
            <DatePicker.RangePicker
              format="DD MMM YYYY"
              className="filter-range"
              aria-label="Period"
              placeholder={['From', 'To']}
              allowEmpty={[true, true]}
              onChange={(range: [Dayjs | null, Dayjs | null] | null) =>
                update({
                  from: range?.[0]?.startOf('day').toISOString(),
                  to: range?.[1]?.endOf('day').toISOString(),
                })
              }
            />
            <Input.Search
              allowClear
              placeholder="User"
              aria-label="Actor"
              className="filter-select"
              onSearch={(value) => update({ actor: value.trim() || undefined })}
            />
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder="Action"
              aria-label="Action"
              className="filter-select filter-select--wide"
              loading={facets.isLoading}
              options={facetOptions(facets.data?.actions)}
              onChange={(action?: string) => update({ action })}
            />
            <Select
              allowClear
              showSearch={{ optionFilterProp: 'label' }}
              placeholder="Record type"
              aria-label="Record type"
              className="filter-select"
              loading={facets.isLoading}
              options={(facets.data?.entityTypes ?? []).map((value) => ({ value, label: value }))}
              onChange={(entityType?: string) => update({ entityType })}
            />
            <Input.Search
              allowClear
              placeholder="Record id"
              aria-label="Record id"
              className="filter-select filter-select--wide"
              onSearch={(value) => update({ entityId: value.trim() || undefined })}
            />
          </>
        }
      >
        <DataTable<AuditRecord>
          rowKey="id"
          loading={records.isFetching}
          dataSource={records.items}
          pagination={records.pagination}
          columns={columns}
          scroll={{}}
          expandable={{
            rowExpandable: (record) => record.before !== null || record.after !== null,
            expandedRowRender: renderAuditChange,
          }}
          locale={{ emptyText: <EmptyState label="No audit records match the filters" /> }}
        />
      </TableCard>
    </>
  );
}
