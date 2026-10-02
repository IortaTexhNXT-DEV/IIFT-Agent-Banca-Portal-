import { Card, Col, Descriptions, Row } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Claim, RequiredDocument } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/format';
import { DocumentPanel } from '../DocumentPanel';
import { Money } from '../Money';
import { PageHeader } from '../PageHeader';
import { StatusTag } from '../StatusTag';
import { useCodes } from './useCodes';
import { useSalesLinks } from './useSalesLinks';

interface Props {
  claim: Claim;
  actions?: ReactNode;
  /** Document types the user may attach; omit for a read-only list. */
  uploadTypes?: RequiredDocument[];
}

/** A claim notification with its policy and supporting documents (AP-43). */
export function ClaimDetailView({ claim, actions, uploadTypes }: Props) {
  const links = useSalesLinks();
  const claimTypes = useCodes('CLAIM_TYPE');
  const home = links.backoffice ? '/backoffice' : '/portal';
  const { policy } = claim;

  return (
    <>
      <PageHeader
        title={claim.claimNo}
        tags={<StatusTag status={claim.status} />}
        meta={[
          { label: 'Type', value: claimTypes.label(claim.claimType) },
          { label: 'Participant', value: policy.participant.fullName },
        ]}
        breadcrumb={[
          { title: 'Home', to: home },
          { title: 'Claims', to: `${home}/claims` },
          { title: claim.claimNo },
        ]}
        extra={actions}
      />
      <Row gutter={[16, 0]}>
        <Col xs={24} xl={14}>
          <Card title="Claim" className="content-card">
            <Descriptions
              size="small"
              column={{ xs: 1, md: 2 }}
              items={[
                { key: 'type', label: 'Claim type', children: claimTypes.label(claim.claimType) },
                { key: 'event', label: 'Event date', children: formatDate(claim.eventDate) },
                {
                  key: 'amount',
                  label: 'Amount claimed',
                  children: <Money value={claim.claimedAmount} />,
                },
                { key: 'notified', label: 'Notified', children: formatDateTime(claim.createdAt) },
                { key: 'description', label: 'Description', children: claim.description, span: 2 },
                { key: 'remarks', label: 'IIFT remarks', children: claim.remarks ?? '–', span: 2 },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card title="Policy" className="content-card">
            <Descriptions
              size="small"
              column={1}
              items={[
                {
                  key: 'policy',
                  label: 'Policy no.',
                  children: <Link to={links.policy(policy.id)}>{policy.policyNo}</Link>,
                },
                { key: 'product', label: 'Product', children: policy.product.name },
                {
                  key: 'participant',
                  label: 'Participant',
                  children: `${policy.participant.fullName} (${policy.participant.participantNo})`,
                },
                {
                  key: 'cover',
                  label: 'Period of cover',
                  children: `${formatDate(policy.startDate)} to ${formatDate(policy.endDate)}`,
                },
                {
                  key: 'agent',
                  label: 'Agent',
                  children: `${policy.agent.fullName} (${policy.agent.agentCode})`,
                },
                { key: 'agency', label: 'Agency / bank', children: policy.agency.name },
              ]}
            />
          </Card>
        </Col>
      </Row>
      <Card className="content-card">
        <DocumentPanel
          ownerType="CLAIM"
          ownerId={claim.id}
          uploadTypes={uploadTypes}
          canUpload={uploadTypes !== undefined}
          title="Supporting documents"
        />
      </Card>
    </>
  );
}
