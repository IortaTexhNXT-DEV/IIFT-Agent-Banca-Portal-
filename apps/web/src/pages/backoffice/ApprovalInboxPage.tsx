import { Card, Input, Select, Tabs } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { ApprovalRequest, ApprovalStatus, ApprovalType } from '../../api/types';
import { ApprovalTable } from '../../components/admin/ApprovalTable';
import { enumOptions } from '../../components/admin/useCodes';
import { FilterBar } from '../../components/FilterBar';
import { PageHeader } from '../../components/PageHeader';
import { humanise } from '../../utils/format';

const TYPES: ApprovalType[] = [
  'AGENT_REGISTRATION',
  'AGENT_PROFILE_UPDATE',
  'AGENT_STATUS_CHANGE',
  'PARTICIPANT_UPDATE',
  'POLICY_REFERRAL',
  'POLICY_ENDORSEMENT',
  'POLICY_CANCELLATION',
  'PAYMENT_VERIFICATION',
];
const STATUSES: ApprovalStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

function TypeFilter({ onChange }: { onChange(type?: ApprovalType): void }) {
  return (
    <Select
      allowClear
      placeholder="All request types"
      aria-label="Request type"
      style={{ width: 220 }}
      options={enumOptions(TYPES, humanise)}
      onChange={onChange}
    />
  );
}

/** BO-21: requests waiting for the user's decision at their current level (never their own). */
function Inbox() {
  const [type, setType] = useState<ApprovalType>();
  const inbox = usePagedQuery<ApprovalRequest>('/backoffice/approvals/inbox', { type });
  return (
    <>
      <FilterBar>
        <TypeFilter
          onChange={(value) => {
            setType(value);
            inbox.resetPage();
          }}
        />
      </FilterBar>
      <Card className="content-card">
        <ApprovalTable
          items={inbox.items}
          loading={inbox.isFetching}
          pagination={inbox.pagination}
          emptyText="Nothing is waiting for your decision"
        />
      </Card>
    </>
  );
}

interface SearchFilters {
  type?: ApprovalType;
  status?: ApprovalStatus;
  requestNo?: string;
}

/** BO-16..19: every request with its outcome, searchable by number, type and status. */
function AllRequests() {
  const [filters, setFilters] = useState<SearchFilters>({});
  const requests = usePagedQuery<ApprovalRequest>('/backoffice/approvals', { ...filters });
  const update = (changes: SearchFilters) => {
    setFilters((current) => ({ ...current, ...changes }));
    requests.resetPage();
  };
  return (
    <>
      <FilterBar>
        <Input.Search
          allowClear
          placeholder="Request no."
          aria-label="Request number"
          style={{ width: 200 }}
          onSearch={(value) => update({ requestNo: value.trim() || undefined })}
        />
        <TypeFilter onChange={(type) => update({ type })} />
        <Select
          allowClear
          placeholder="All statuses"
          aria-label="Status"
          style={{ width: 160 }}
          options={enumOptions(STATUSES, humanise)}
          onChange={(status?: ApprovalStatus) => update({ status })}
        />
      </FilterBar>
      <Card className="content-card">
        <ApprovalTable
          items={requests.items}
          loading={requests.isFetching}
          pagination={requests.pagination}
          showStatus
          emptyText="No requests match the filters"
        />
      </Card>
    </>
  );
}

/** BO-16..21: maker-checker approval inbox and request search. */
export default function ApprovalInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Registrations, changes, referrals and payments that need a checker's decision"
        breadcrumb={[{ title: 'Dashboard', to: '/backoffice' }, { title: 'Approvals' }]}
      />
      <Tabs
        activeKey={searchParams.get('tab') ?? 'inbox'}
        onChange={(tab) => setSearchParams(tab === 'inbox' ? {} : { tab }, { replace: true })}
        destroyOnHidden
        items={[
          { key: 'inbox', label: 'Awaiting my decision', children: <Inbox /> },
          { key: 'all', label: 'All requests', children: <AllRequests /> },
        ]}
      />
    </>
  );
}
