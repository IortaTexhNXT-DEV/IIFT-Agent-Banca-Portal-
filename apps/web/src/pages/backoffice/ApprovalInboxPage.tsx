import { Card, Input, Select } from 'antd';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { usePagedQuery } from '../../api/hooks';
import type { ApprovalRequest, ApprovalStatus, ApprovalType } from '../../api/types';
import { ApprovalTable } from '../../components/admin/ApprovalTable';
import { enumOptions } from '../../components/admin/useCodes';
import { PageHeader } from '../../components/PageHeader';
import { TableToolbar } from '../../components/TableCard';
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

type Tab = 'inbox' | 'all';

function TypeFilter({ onChange }: { onChange(type?: ApprovalType): void }) {
  return (
    <Select
      allowClear
      placeholder="Request type"
      aria-label="Request type"
      className="filter-select filter-select--wide"
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
      <TableToolbar
        filters={
          <TypeFilter
            onChange={(value) => {
              setType(value);
              inbox.resetPage();
            }}
          />
        }
      />
      <ApprovalTable
        items={inbox.items}
        loading={inbox.isFetching}
        pagination={inbox.pagination}
        emptyText="Nothing awaiting your decision"
      />
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
      <TableToolbar
        filters={
          <>
            <Input.Search
              allowClear
              placeholder="Request no."
              aria-label="Request number"
              className="filter-select"
              onSearch={(value) => update({ requestNo: value.trim() || undefined })}
            />
            <TypeFilter onChange={(type) => update({ type })} />
            <Select
              allowClear
              placeholder="Status"
              aria-label="Status"
              className="filter-select"
              options={enumOptions(STATUSES, humanise)}
              onChange={(status?: ApprovalStatus) => update({ status })}
            />
          </>
        }
      />
      <ApprovalTable
        items={requests.items}
        loading={requests.isFetching}
        pagination={requests.pagination}
        showStatus
        emptyText="No requests match the filters"
      />
    </>
  );
}

/** BO-16..21: maker-checker approval inbox and request search. */
export default function ApprovalInboxPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'all' ? 'all' : 'inbox';
  return (
    <>
      <PageHeader
        title="Approvals"
        breadcrumb={[{ title: 'Home', to: '/backoffice' }, { title: 'Approvals' }]}
      />
      <Card
        className="content-card content-card--flush"
        activeTabKey={tab}
        tabProps={{ size: 'middle' }}
        onTabChange={(key) =>
          setSearchParams(key === 'inbox' ? {} : { tab: key }, { replace: true })
        }
        tabList={[
          { key: 'inbox', label: 'Awaiting my decision' },
          { key: 'all', label: 'All requests' },
        ]}
      >
        {tab === 'inbox' ? <Inbox /> : <AllRequests />}
      </Card>
    </>
  );
}
