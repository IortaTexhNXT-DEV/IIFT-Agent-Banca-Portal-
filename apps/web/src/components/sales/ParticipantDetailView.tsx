import { Card, Flex, Table, Tabs } from 'antd';
import { type ReactNode, useState } from 'react';
import type { ParticipantDetail, ParticipantPolicy } from '../../api/sales-types';
import type { Money as MoneyValue } from '../../api/types';
import { formatDate } from '../../utils/format';
import { ApprovalHistory } from '../ApprovalHistory';
import { DocumentPanel } from '../DocumentPanel';
import { Money } from '../Money';
import { PageHeader } from '../PageHeader';
import { StatusTag } from '../StatusTag';
import { AmlOutcome } from './AmlOutcome';
import { AmlScreeningsTable } from './AmlScreeningsTable';
import { humanise } from '../../utils/format';
import { ParticipantProfile } from './ParticipantProfile';
import { PolicyLink } from './PolicyTable';
import { useSalesLinks } from './useSalesLinks';

function ParticipantPolicies({ policies }: { policies: ParticipantPolicy[] }) {
  return (
    <Table<ParticipantPolicy>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={policies}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No quotations or policies' }}
      columns={[
        { title: 'Policy / quotation no.', key: 'reference', render: (_, policy) => <PolicyLink policy={policy} /> },
        { title: 'Product', dataIndex: ['product', 'name'] },
        { title: 'Status', dataIndex: 'status', render: (status: string) => <StatusTag status={status} /> },
        { title: 'Payment', dataIndex: 'paymentStatus', render: (status: string) => <StatusTag status={status} /> },
        { title: 'Contribution', dataIndex: 'contribution', align: 'right', render: (value: MoneyValue) => <Money value={value} /> },
        { title: 'Cover', key: 'cover', render: (_, policy) => (policy.startDate ? `${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}` : '–') },
        { title: 'Agency / bank', dataIndex: ['agency', 'name'] },
        { title: 'Agent', dataIndex: ['agent', 'fullName'] },
      ]}
    />
  );
}

interface Props {
  participant: ParticipantDetail;
  actions?: ReactNode;
  canUpload?: boolean;
}

/** Participant record shared by the portal and the back-office: profile, policies, documents, approvals (AP-11..16). */
export function ParticipantDetailView({ participant, actions, canUpload = false }: Props) {
  const { backoffice } = useSalesLinks();
  const [tab, setTab] = useState('policies');
  const home = backoffice ? '/backoffice' : '/portal';

  return (
    <>
      <PageHeader
        title={
          <Flex align="center" gap={8} wrap>
            {participant.fullName}
            <StatusTag status={participant.amlStatus} />
          </Flex>
        }
        subtitle={`${participant.participantNo} · ${humanise(participant.type)}`}
        breadcrumb={[{ title: 'Home', to: home }, { title: 'Participants', to: `${home}/participants` }, { title: participant.participantNo }]}
        extra={actions}
      />
      {participant.amlStatus !== 'CLEAR' && <AmlOutcome status={participant.amlStatus} className="mb-16" />}
      <Card title="Profile" className="content-card">
        <ParticipantProfile participant={participant} />
      </Card>
      <Card className="content-card" styles={{ body: { paddingTop: 4 } }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: 'policies', label: `Policies (${participant.policies.length})`, children: <ParticipantPolicies policies={participant.policies} /> },
            { key: 'documents', label: 'Documents', children: <DocumentPanel ownerType="PARTICIPANT" ownerId={participant.id} canUpload={canUpload} /> },
            { key: 'approvals', label: 'Update requests', children: <ApprovalHistory approvals={participant.approvals} /> },
            ...(backoffice ? [{ key: 'screenings', label: 'AML screening', children: <AmlScreeningsTable screenings={participant.screenings} /> }] : []),
          ]}
        />
      </Card>
    </>
  );
}
