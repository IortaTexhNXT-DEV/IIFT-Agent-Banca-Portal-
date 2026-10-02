import { Alert, Card, Col, Row } from 'antd';
import { Link } from 'react-router';
import type { PolicyDetail } from '../../api/types';
import { formatDate } from '../../utils/format';
import { FieldGrid } from '../FieldGrid';
import { Money } from '../Money';
import { ContributionBreakdown } from './ContributionBreakdown';
import { NomineesTable } from './NomineesTable';
import { formatTerm } from './options';
import { ParticipantProfile } from './ParticipantProfile';
import { QuestionnaireAnswers } from './QuestionnaireAnswers';
import { RiskDetails } from './RiskDetails';
import { useSalesLinks } from './useSalesLinks';

function coverPeriod({ startDate, endDate }: PolicyDetail): string {
  if (startDate && endDate) return `${formatDate(startDate)} – ${formatDate(endDate)}`;
  return startDate ? `From ${formatDate(startDate)}` : 'Starts on issue';
}

/** Product, plan, period and amounts of a quotation or policy. */
function CoverFields({ policy }: { policy: PolicyDetail }) {
  const { config } = policy.product;
  const plan = config.plans?.find((candidate) => candidate.code === policy.planCode);
  const coverageType = config.coverageTypes?.find(
    (candidate) => candidate.code === policy.coverageType,
  );
  return (
    <FieldGrid
      columns={3}
      items={[
        {
          key: 'product',
          label: 'Product',
          value: `${policy.product.name} (${policy.product.code})`,
        },
        { key: 'lob', label: 'Line of business', value: policy.product.lineOfBusiness },
        plan && { key: 'plan', label: 'Plan', value: plan.name },
        coverageType && { key: 'coverage', label: 'Coverage type', value: coverageType.name },
        plan?.additionalCover && {
          key: 'additional',
          label: 'Additional cover',
          value:
            policy.riskDetails.additionalCover === true
              ? plan.additionalCover.name
              : 'Not included',
        },
        { key: 'term', label: 'Term', value: formatTerm(policy.termMonths) },
        { key: 'period', label: 'Period of cover', value: coverPeriod(policy) },
        { key: 'sum', label: 'Sum covered', value: <Money value={policy.sumCovered} strong /> },
        {
          key: 'contribution',
          label: 'Contribution',
          value: <Money value={policy.contribution} strong />,
        },
        {
          key: 'outstanding',
          label: 'Outstanding',
          value: <Money value={policy.outstandingAmount} />,
        },
        policy.paymentDueDate && {
          key: 'due',
          label: 'Payment due',
          value: formatDate(policy.paymentDueDate),
        },
      ]}
    />
  );
}

/** Numbers, servicing agent and the dates of the policy's lifecycle. */
function RecordFields({ policy }: { policy: PolicyDetail }) {
  const links = useSalesLinks();
  return (
    <FieldGrid
      columns={3}
      items={[
        { key: 'quotationNo', label: 'Quotation no.', value: policy.quotationNo },
        { key: 'policyNo', label: 'Policy no.', value: policy.policyNo ?? 'Not issued' },
        policy.renewalOf && {
          key: 'renewal',
          label: 'Renewal of',
          value: (
            <Link to={links.policy(policy.renewalOf.id)}>
              {policy.renewalOf.policyNo ?? 'Previous policy'}
            </Link>
          ),
        },
        {
          key: 'agent',
          label: 'Agent',
          value: `${policy.agent.fullName} (${policy.agent.agentCode})`,
        },
        { key: 'agency', label: 'Agency / bank', value: policy.agency.name },
        { key: 'created', label: 'Quoted', value: formatDate(policy.createdAt) },
        policy.submittedAt && {
          key: 'submitted',
          label: 'Submitted',
          value: formatDate(policy.submittedAt),
        },
        policy.issuedAt && { key: 'issued', label: 'Issued', value: formatDate(policy.issuedAt) },
        policy.cancelledAt && {
          key: 'cancelled',
          label: 'Cancelled',
          value: formatDate(policy.cancelledAt),
        },
        policy.cancellationReason && {
          key: 'cancellationReason',
          label: 'Cancellation reason',
          value: policy.cancellationReason,
          span: 'full',
        },
      ]}
    />
  );
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
      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Card title="Cover" className="content-card">
            <CoverFields policy={policy} />
          </Card>
          <Card title="Policy record" className="content-card">
            <RecordFields policy={policy} />
          </Card>
          {Object.keys(riskDetails).length > 0 && (
            <Card title="Risk details" className="content-card">
              <RiskDetails details={riskDetails} fields={policy.product.config.riskFields} />
            </Card>
          )}
          {showNominees && (
            <Card title="Nominees" className="content-card content-card--flush">
              <NomineesTable nominees={policy.nominees} />
            </Card>
          )}
          <Card title="Declarations" className="content-card">
            <QuestionnaireAnswers
              questions={policy.product.questionnaire}
              answers={policy.questionnaire}
            />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Contribution" className="content-card">
            <ContributionBreakdown
              lines={policy.contributionBreakdown.lines}
              contribution={policy.contribution}
              tabarru={policy.contributionBreakdown.tabarru}
              wakalahFee={policy.contributionBreakdown.wakalahFee}
            />
          </Card>
          <Card title="Participant" className="content-card">
            <ParticipantProfile participant={policy.participant} compact />
          </Card>
        </Col>
      </Row>
    </>
  );
}
