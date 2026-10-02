import { Card, DatePicker, Descriptions, Input, Select, Table } from 'antd';
import type { Dayjs } from 'dayjs';
import { useState } from 'react';
import { Link } from 'react-router';
import { useApiQuery, usePagedQuery } from '../../api/hooks';
import type { AuditFacets, AuditRecord } from '../../api/admin-types';
import { ChangeTable } from '../../components/admin/ChangeTable';
import { recordPath } from '../../components/admin/links';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { formatDateTime, humanise } from '../../utils/format';
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
    <>
      <ChangeTable before={record.before} after={record.after} />
      <Descriptions
        size="small"
        className="audit-meta"
        column={{ xs: 1, md: 2 }}
        items={[
          { key: 'agent', label: 'Browser / client', children: record.userAgent ?? '–' },
          { key: 'correlation', label: 'Correlation id', children: record.correlationId ?? '–' },
        ]}
      />
    </>
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

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Every change, decision, sign-in and download, with the values before and after"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Audit trail' }]}
      />
      <FilterBar>
        <DatePicker.RangePicker
          format="DD MMM YYYY"
          style={{ width: 260 }}
          aria-label="Period"
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
          placeholder="User name"
          aria-label="Actor"
          style={{ width: 160 }}
          onSearch={(value) => update({ actor: value.trim() || undefined })}
        />
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Action"
          aria-label="Action"
          style={{ width: 210 }}
          loading={facets.isLoading}
          options={facetOptions(facets.data?.actions)}
          onChange={(action?: string) => update({ action })}
        />
        <Select
          allowClear
          showSearch={{ optionFilterProp: 'label' }}
          placeholder="Record type"
          aria-label="Record type"
          style={{ width: 160 }}
          loading={facets.isLoading}
          options={(facets.data?.entityTypes ?? []).map((value) => ({ value, label: value }))}
          onChange={(entityType?: string) => update({ entityType })}
        />
        <Input.Search
          allowClear
          placeholder="Record id"
          aria-label="Record id"
          style={{ width: 200 }}
          onSearch={(value) => update({ entityId: value.trim() || undefined })}
        />
      </FilterBar>
      <Card className="content-card">
        <Table<AuditRecord>
          size="middle"
          rowKey="id"
          loading={records.isFetching}
          dataSource={records.items}
          pagination={records.pagination}
          locale={{ emptyText: 'No audit records match the filters' }}
          expandable={{
            rowExpandable: (record) => record.before !== null || record.after !== null,
            expandedRowRender: renderAuditChange,
          }}
          columns={[
            { title: 'When', dataIndex: 'occurredAt', render: formatDateTime },
            { title: 'User', dataIndex: 'actorName' },
            { title: 'Action', dataIndex: 'action', render: humanise },
            { title: 'Record type', dataIndex: 'entityType' },
            {
              title: 'Record id',
              dataIndex: 'entityId',
              render: (entityId: string | null, record) => {
                const path = recordPath('BACKOFFICE', record.entityType, entityId);
                return path ? <Link to={path}>{entityId}</Link> : (entityId ?? '–');
              },
            },
            {
              title: 'IP address',
              dataIndex: 'ipAddress',
              render: (ip: string | null) => ip ?? '–',
            },
          ]}
        />
      </Card>
    </>
  );
}
