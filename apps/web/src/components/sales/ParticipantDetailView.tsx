import { Card, Col, Row, Tabs } from 'antd';
import { type ReactNode, useState } from 'react';
import type { ParticipantDetail, ParticipantPolicy } from '../../api/sales-types';
import { formatDate, humanise } from '../../utils/format';
import { ApprovalHistory } from '../ApprovalHistory';
import {
  DataTable,
  moneyColumn,
  paymentStatusColumn,
  statusColumn,
  textColumn,
} from '../DataTable';
import { DocumentPanel } from '../DocumentPanel';
import { EmptyState } from '../EmptyState';
import { FieldGrid } from '../FieldGrid';
import { Money } from '../Money';
import { PageHeader } from '../PageHeader';
import { StatusTag } from '../StatusTag';
import { AmlOutcome } from './AmlOutcome';
import { AmlScreeningsTable } from './AmlScreeningsTable';
import { ParticipantProfile } from './ParticipantProfile';
import { PolicyLink } from './PolicyTable';
import { useSalesLinks } from './useSalesLinks';

function ParticipantPolicies({ policies }: { policies: ParticipantPolicy[] }) {
  return (
    <DataTable<ParticipantPolicy>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={policies}
      scroll={{}}
      locale={{ emptyText: <EmptyState label="No quotations or policies yet" /> }}
      columns={[
        {
          title: 'Policy / quotation',
          key: 'reference',
          width: 165,
          render: (_, policy) => <PolicyLink policy={policy} />,
        },
        textColumn('Product', ['product', 'name']),
        statusColumn('Status', 'status', 135),
        paymentStatusColumn('Payment', 'paymentStatus'),
        moneyColumn('Contribution', 'contribution', 120),
        {
          title: 'Period of cover',
          key: 'cover',
          width: 200,
          render: (_, policy) =>
            policy.startDate
              ? `${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}`
              : '–',
        },
        textColumn('Agent', ['agent', 'fullName'], 150),
      ]}
    />
  );
}

/** Portfolio figures shown beside the profile. */
function ParticipantSummary({ participant }: { participant: ParticipantDetail }) {
  const active = participant.policies.filter((policy) => policy.status === 'ACTIVE');
  const contribution = active.reduce((sum, policy) => sum + Number(policy.contribution), 0);
  return (
    <FieldGrid
      columns={2}
      items={[
        { key: 'policies', label: 'Policies', value: participant.policies.length },
        { key: 'active', label: 'Active', value: active.length },
        {
          key: 'contribution',
          label: 'Active contribution',
          value: <Money value={contribution} strong />,
        },
        { key: 'aml', label: 'AML screening', value: <StatusTag status={participant.amlStatus} /> },
        { key: 'documents', label: 'Documents', value: participant.documents.length },
        {
          key: 'pending',
          label: 'Pending requests',
          value: participant.approvals.filter((request) => request.status === 'PENDING').length,
        },
      ]}
    />
  );
}

function TabCard({ children }: { children: ReactNode }) {
  return <Card className="content-card">{children}</Card>;
}

function count(label: string, total: number): string {
  return total > 0 ? `${label} (${total})` : label;
}

interface Props {
  participant: ParticipantDetail;
  actions?: ReactNode;
  canUpload?: boolean;
}

/** Participant record shared by the portal and the back-office: profile, policies, documents, approvals (AP-11..16). */
export function ParticipantDetailView({ participant, actions, canUpload = false }: Props) {
  const { backoffice } = useSalesLinks();
  const [tab, setTab] = useState('overview');
  const home = backoffice ? '/backoffice' : '/portal';

  return (
    <>
      <PageHeader
        title={participant.fullName}
        tags={<StatusTag status={participant.amlStatus} />}
        meta={[
          { label: 'Participant no.', value: participant.participantNo },
          { label: 'Type', value: humanise(participant.type) },
          { label: 'ID', value: participant.idNumberMasked },
          { label: 'Mobile', value: participant.mobile },
        ]}
        breadcrumb={[
          { title: 'Home', to: home },
          { title: 'Participants', to: `${home}/participants` },
          { title: participant.participantNo },
        ]}
        extra={actions}
      />
      {participant.amlStatus !== 'CLEAR' && (
        <AmlOutcome status={participant.amlStatus} className="mb-16" />
      )}
      <Tabs
        className="page-tabs"
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'overview',
            label: 'Overview',
            children: (
              <Row gutter={16}>
                <Col xs={24} xl={16}>
                  <Card title="Profile" className="content-card">
                    <ParticipantProfile participant={participant} />
                  </Card>
                </Col>
                <Col xs={24} xl={8}>
                  <Card title="Portfolio" className="content-card">
                    <ParticipantSummary participant={participant} />
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: 'policies',
            label: count('Policies', participant.policies.length),
            children: (
              <Card className="content-card content-card--flush">
                <ParticipantPolicies policies={participant.policies} />
              </Card>
            ),
          },
          {
            key: 'documents',
            label: count('Documents', participant.documents.length),
            children: (
              <TabCard>
                <DocumentPanel
                  ownerType="PARTICIPANT"
                  ownerId={participant.id}
                  canUpload={canUpload}
                />
              </TabCard>
            ),
          },
          {
            key: 'approvals',
            label: count('Update requests', participant.approvals.length),
            children: (
              <TabCard>
                <ApprovalHistory approvals={participant.approvals} />
              </TabCard>
            ),
          },
          ...(backoffice
            ? [
                {
                  key: 'screenings',
                  label: count('AML screening', participant.screenings.length),
                  children: (
                    <Card className="content-card content-card--flush">
                      <AmlScreeningsTable screenings={participant.screenings} />
                    </Card>
                  ),
                },
              ]
            : []),
        ]}
      />
    </>
  );
}
