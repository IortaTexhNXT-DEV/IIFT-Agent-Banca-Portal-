import { Card, Col, Row } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Claim, RequiredDocument } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/format';
import { DocumentPanel } from '../DocumentPanel';
import { FieldGrid } from '../FieldGrid';
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
          { label: 'Policy', value: policy.policyNo },
          { label: 'Participant', value: policy.participant.fullName },
        ]}
        breadcrumb={[
          { title: 'Home', to: home },
          { title: 'Claims', to: `${home}/claims` },
          { title: claim.claimNo },
        ]}
        extra={actions}
      />
      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Card title="Claim" className="content-card">
            <FieldGrid
              columns={3}
              items={[
                { key: 'type', label: 'Claim type', value: claimTypes.label(claim.claimType) },
                { key: 'event', label: 'Event date', value: formatDate(claim.eventDate) },
                {
                  key: 'amount',
                  label: 'Amount claimed',
                  value: <Money value={claim.claimedAmount} strong />,
                },
                { key: 'notified', label: 'Notified', value: formatDateTime(claim.createdAt) },
                { key: 'status', label: 'Status', value: <StatusTag status={claim.status} /> },
                {
                  key: 'description',
                  label: 'Description',
                  value: claim.description,
                  span: 'full',
                },
                { key: 'remarks', label: 'IIFT remarks', value: claim.remarks, span: 'full' },
              ]}
            />
          </Card>
          <Card className="content-card">
            <DocumentPanel
              ownerType="CLAIM"
              ownerId={claim.id}
              uploadTypes={uploadTypes}
              canUpload={uploadTypes !== undefined}
              title="Supporting documents"
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Policy" className="content-card">
            <FieldGrid
              columns={2}
              items={[
                {
                  key: 'policy',
                  label: 'Policy no.',
                  value: <Link to={links.policy(policy.id)}>{policy.policyNo}</Link>,
                },
                {
                  key: 'participantNo',
                  label: 'Participant no.',
                  value: policy.participant.participantNo,
                },
                { key: 'product', label: 'Product', value: policy.product.name, span: 2 },
                {
                  key: 'participant',
                  label: 'Participant',
                  value: policy.participant.fullName,
                  span: 2,
                },
                {
                  key: 'cover',
                  label: 'Period of cover',
                  value: `${formatDate(policy.startDate)} – ${formatDate(policy.endDate)}`,
                  span: 2,
                },
                {
                  key: 'agent',
                  label: 'Agent',
                  value: `${policy.agent.fullName} (${policy.agent.agentCode})`,
                  span: 2,
                },
                { key: 'agency', label: 'Agency / bank', value: policy.agency.name, span: 2 },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
}
