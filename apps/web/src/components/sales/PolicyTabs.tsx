import { Card, Tabs } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PolicyDetail, RequiredDocument } from '../../api/types';
import { ApprovalHistory } from '../ApprovalHistory';
import { DataTable, dateColumn, statusColumn } from '../DataTable';
import { DocumentPanel } from '../DocumentPanel';
import { EmptyState } from '../EmptyState';
import { PolicyEventsTimeline } from './PolicyEventsTimeline';
import { PolicyOverview } from './PolicyOverview';
import { PolicyPayments } from './PolicyPayments';
import { useCodes } from './useCodes';
import { useSalesLinks } from './useSalesLinks';

export type PolicyTabKey =
  'overview' | 'documents' | 'payments' | 'history' | 'approvals' | 'claims';

type PolicyClaim = PolicyDetail['claims'][number];

function PolicyClaims({ claims }: { claims: PolicyClaim[] }) {
  const links = useSalesLinks();
  const claimTypes = useCodes('CLAIM_TYPE');
  return (
    <DataTable<PolicyClaim>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={claims}
      scroll={{}}
      locale={{ emptyText: <EmptyState label="No claims" inline /> }}
      columns={[
        {
          title: 'Claim no.',
          dataIndex: 'claimNo',
          width: 150,
          render: (claimNo: string, claim) => <Link to={links.claim(claim.id)}>{claimNo}</Link>,
        },
        { title: 'Type', dataIndex: 'claimType', render: claimTypes.label },
        dateColumn('Event date', 'eventDate', 130),
        statusColumn('Status', 'status', 140),
      ]}
    />
  );
}

interface Props {
  policy: PolicyDetail;
  activeKey: PolicyTabKey;
  onChange(key: PolicyTabKey): void;
  /** Document types offered for upload; omit for a read-only document list. */
  uploadTypes?: RequiredDocument[];
  /** Action shown above the claims list (portal: notify a claim). */
  claimsAction?: ReactNode;
}

function count(label: string, total: number): string {
  return total > 0 ? `${label} (${total})` : label;
}

/** A tab's content in a card; the overview tab lays out its own cards. */
function TabCard({ children }: { children: ReactNode }) {
  return <Card className="content-card">{children}</Card>;
}

/** Tabs of the policy page, shared by the portal and the back-office (AP-24, AP-30/31, AP-44..47). */
export function PolicyTabs({ policy, activeKey, onChange, uploadTypes, claimsAction }: Props) {
  return (
    <Tabs
      className="page-tabs"
      activeKey={activeKey}
      onChange={(key) => onChange(key as PolicyTabKey)}
      items={[
        { key: 'overview', label: 'Overview', children: <PolicyOverview policy={policy} /> },
        {
          key: 'documents',
          label: count('Documents', policy.documents.length),
          children: (
            <TabCard>
              <DocumentPanel
                ownerType="POLICY"
                ownerId={policy.id}
                uploadTypes={uploadTypes}
                canUpload={uploadTypes !== undefined}
              />
            </TabCard>
          ),
        },
        {
          key: 'payments',
          label: count('Payments & receipts', policy.allocations.length),
          children: (
            <TabCard>
              <PolicyPayments policy={policy} />
            </TabCard>
          ),
        },
        {
          key: 'history',
          label: 'History',
          children: (
            <TabCard>
              <PolicyEventsTimeline events={policy.events} />
            </TabCard>
          ),
        },
        {
          key: 'approvals',
          label: count('Approvals', policy.approvals.length),
          children: (
            <TabCard>
              <ApprovalHistory approvals={policy.approvals} />
            </TabCard>
          ),
        },
        {
          key: 'claims',
          label: count('Claims', policy.claims.length),
          children: (
            <TabCard>
              {claimsAction && <div className="tab-actions">{claimsAction}</div>}
              <PolicyClaims claims={policy.claims} />
            </TabCard>
          ),
        },
      ]}
    />
  );
}
