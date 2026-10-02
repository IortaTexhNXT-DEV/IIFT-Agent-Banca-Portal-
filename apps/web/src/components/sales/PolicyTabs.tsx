import { Card, Table, Tabs } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { PolicyDetail, RequiredDocument } from '../../api/types';
import { formatDate } from '../../utils/format';
import { ApprovalHistory } from '../ApprovalHistory';
import { DocumentPanel } from '../DocumentPanel';
import { StatusTag } from '../StatusTag';
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
    <Table<PolicyClaim>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={claims}
      locale={{ emptyText: 'No claims notified on this policy' }}
      columns={[
        {
          title: 'Claim no.',
          dataIndex: 'claimNo',
          render: (claimNo: string, claim) => <Link to={links.claim(claim.id)}>{claimNo}</Link>,
        },
        { title: 'Type', dataIndex: 'claimType', render: claimTypes.label },
        { title: 'Event date', dataIndex: 'eventDate', render: formatDate },
        {
          title: 'Status',
          dataIndex: 'status',
          render: (status: string) => <StatusTag status={status} />,
        },
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

/** Tabs of the policy page, shared by the portal and the back-office (AP-24, AP-30/31, AP-44..47). */
export function PolicyTabs({ policy, activeKey, onChange, uploadTypes, claimsAction }: Props) {
  return (
    <Card className="content-card" styles={{ body: { paddingTop: 4 } }}>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => onChange(key as PolicyTabKey)}
        items={[
          { key: 'overview', label: 'Overview', children: <PolicyOverview policy={policy} /> },
          {
            key: 'documents',
            label: count('Documents', policy.documents.length),
            children: (
              <DocumentPanel
                ownerType="POLICY"
                ownerId={policy.id}
                uploadTypes={uploadTypes}
                canUpload={uploadTypes !== undefined}
              />
            ),
          },
          {
            key: 'payments',
            label: count('Payments & receipts', policy.allocations.length),
            children: <PolicyPayments policy={policy} />,
          },
          {
            key: 'history',
            label: 'History',
            children: <PolicyEventsTimeline events={policy.events} />,
          },
          {
            key: 'approvals',
            label: count('Approvals', policy.approvals.length),
            children: <ApprovalHistory approvals={policy.approvals} />,
          },
          {
            key: 'claims',
            label: count('Claims', policy.claims.length),
            children: (
              <>
                {claimsAction && <div className="tab-actions">{claimsAction}</div>}
                <PolicyClaims claims={policy.claims} />
              </>
            ),
          },
        ]}
      />
    </Card>
  );
}
