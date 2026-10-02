import { Alert, Card, Col, Descriptions, type DescriptionsProps, Row } from 'antd';
import { Link } from 'react-router';
import type { PolicyDetail } from '../../api/types';
import { formatDate } from '../../utils/format';
import { Money } from '../Money';
import { ContributionBreakdown } from './ContributionBreakdown';
import { NomineesTable } from './NomineesTable';
import { formatTerm } from './options';
import { ParticipantProfile } from './ParticipantProfile';
import { QuestionnaireAnswers } from './QuestionnaireAnswers';
import { RiskDetails } from './RiskDetails';
import { useSalesLinks } from './useSalesLinks';

function coverPeriod({ startDate, endDate }: PolicyDetail): string {
  if (startDate && endDate) return `${formatDate(startDate)} to ${formatDate(endDate)}`;
  return startDate ? `From ${formatDate(startDate)}` : 'Starts on issuance';
}

/** Cover, plan and period of a quotation or policy. */
function CoverDescriptions({ policy }: { policy: PolicyDetail }) {
  const links = useSalesLinks();
  const { config } = policy.product;
  const plan = config.plans?.find((candidate) => candidate.code === policy.planCode);
  const coverageType = config.coverageTypes?.find(
    (candidate) => candidate.code === policy.coverageType,
  );

  const items: DescriptionsProps['items'] = [
    {
      key: 'product',
      label: 'Product',
      children: `${policy.product.name} (${policy.product.code})`,
    },
    { key: 'lob', label: 'Line of business', children: policy.product.lineOfBusiness },
    ...(plan ? [{ key: 'plan', label: 'Plan', children: plan.name }] : []),
    ...(coverageType
      ? [{ key: 'coverage', label: 'Coverage type', children: coverageType.name }]
      : []),
    ...(plan?.additionalCover
      ? [
          {
            key: 'additional',
            label: 'Additional cover',
            children:
              policy.riskDetails.additionalCover === true
                ? plan.additionalCover.name
                : 'Not included',
          },
        ]
      : []),
    { key: 'term', label: 'Term', children: formatTerm(policy.termMonths) },
    {
      key: 'period',
      label: 'Period of cover',
      children: coverPeriod(policy),
    },
    { key: 'sum', label: 'Sum covered', children: <Money value={policy.sumCovered} strong /> },
    {
      key: 'contribution',
      label: 'Contribution',
      children: <Money value={policy.contribution} strong />,
    },
    {
      key: 'outstanding',
      label: 'Outstanding',
      children: <Money value={policy.outstandingAmount} />,
    },
    ...(policy.paymentDueDate
      ? [{ key: 'due', label: 'Payment due', children: formatDate(policy.paymentDueDate) }]
      : []),
    { key: 'quotationNo', label: 'Quotation no.', children: policy.quotationNo },
    { key: 'policyNo', label: 'Policy no.', children: policy.policyNo ?? 'Not issued' },
    {
      key: 'agent',
      label: 'Agent',
      children: `${policy.agent.fullName} (${policy.agent.agentCode})`,
    },
    { key: 'agency', label: 'Agency / bank', children: policy.agency.name },
    { key: 'created', label: 'Quoted', children: formatDate(policy.createdAt) },
    ...(policy.submittedAt
      ? [{ key: 'submitted', label: 'Submitted', children: formatDate(policy.submittedAt) }]
      : []),
    ...(policy.issuedAt
      ? [{ key: 'issued', label: 'Issued', children: formatDate(policy.issuedAt) }]
      : []),
    ...(policy.renewalOf
      ? [
          {
            key: 'renewal',
            label: 'Renewal of',
            children: (
              <Link to={links.policy(policy.renewalOf.id)}>
                {policy.renewalOf.policyNo ?? 'Previous policy'}
              </Link>
            ),
          },
        ]
      : []),
    ...(policy.cancelledAt
      ? [
          {
            key: 'cancelled',
            label: 'Cancelled',
            children: `${formatDate(policy.cancelledAt)}${policy.cancellationReason ? ` – ${policy.cancellationReason}` : ''}`,
          },
        ]
      : []),
  ];
  return <Descriptions size="small" column={{ xs: 1, md: 2 }} items={items} />;
}

/** Overview tab of the policy page, shared by the portal and the back-office. */
export function PolicyOverview({ policy }: { policy: PolicyDetail }) {
  // Additional cover is shown with the plan; the remaining entries are product risk details.
  const { additionalCover: _additionalCover, ...riskDetails } = policy.riskDetails;
  const showNominees = policy.product.config.requiresNominee === true || policy.nominees.length > 0;
  return (
    <>
      {policy.referralReasons.length > 0 && (
        <Alert
          className="mb-16"
          type="warning"
          showIcon
          title="Referred to IIFT for underwriting approval"
          description={
            <ul className="plain-list">
              {policy.referralReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          }
        />
      )}
      <Row gutter={[16, 0]}>
        <Col xs={24} xl={14}>
          <Card size="small" title="Cover" className="content-card">
            <CoverDescriptions policy={policy} />
          </Card>
          {Object.keys(riskDetails).length > 0 && (
            <Card size="small" title="Risk details" className="content-card">
              <RiskDetails details={riskDetails} fields={policy.product.config.riskFields} />
            </Card>
          )}
          <Card size="small" title="Declarations" className="content-card">
            <QuestionnaireAnswers
              questions={policy.product.questionnaire}
              answers={policy.questionnaire}
            />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card size="small" title="Contribution" className="content-card">
            <ContributionBreakdown
              lines={policy.contributionBreakdown.lines}
              contribution={policy.contribution}
              tabarru={policy.contributionBreakdown.tabarru}
              wakalahFee={policy.contributionBreakdown.wakalahFee}
            />
          </Card>
          <Card size="small" title="Participant" className="content-card">
            <ParticipantProfile participant={policy.participant} compact />
          </Card>
          {showNominees && (
            <Card size="small" title="Nominees" className="content-card">
              <NomineesTable nominees={policy.nominees} />
            </Card>
          )}
        </Col>
      </Row>
    </>
  );
}
