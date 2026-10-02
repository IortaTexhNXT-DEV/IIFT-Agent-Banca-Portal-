import { Button, Card, Col, Form, Row, Steps } from 'antd';
import { type ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ParticipantMatch, QuoteRequest } from '../../api/sales-types';
import type { Product } from '../../api/types';
import { ActionBar } from '../../components/ActionBar';
import { ErrorAlert } from '../../components/ErrorAlert';
import { type FieldItem, FieldGrid } from '../../components/FieldGrid';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { AmlOutcome } from '../../components/sales/AmlOutcome';
import {
  type CoverageValues,
  CoverageForm,
  initialCoverage,
  toQuoteOptions,
} from '../../components/sales/CoverageForm';
import { formatTerm } from '../../components/sales/options';
import { ParticipantPicker } from '../../components/sales/ParticipantPicker';
import { ProductChooser } from '../../components/sales/ProductChooser';
import { QuotePreview, useIndicativeQuote } from '../../components/sales/QuotePreview';
import { riskDetailItems } from '../../components/sales/RiskDetails';
import '../../styles/sales.css';

const STEPS = [
  { title: 'Product' },
  { title: 'Participant' },
  { title: 'Coverage' },
  { title: 'Review' },
];

type IndicativeQuote = ReturnType<typeof useIndicativeQuote>;

/** A participant passed in router state, e.g. from the participant page's "New quotation" action. */
function presetParticipant(state: unknown): ParticipantMatch | null {
  if (state && typeof state === 'object' && 'participant' in state) {
    return (state as { participant: ParticipantMatch }).participant;
  }
  return null;
}

function participantItems(participant: ParticipantMatch): FieldItem[] {
  return [
    { key: 'name', label: 'Name', value: participant.fullName },
    { key: 'no', label: 'Participant no.', value: participant.participantNo },
    { key: 'id', label: 'ID', value: participant.idNumberMasked },
    { key: 'aml', label: 'AML', value: <StatusTag status={participant.amlStatus} /> },
  ];
}

function coverageItems(product: Product, coverage: CoverageValues): FieldItem[] {
  const { config } = product;
  const plan = config.plans?.find((candidate) => candidate.code === coverage.planCode);
  const coverageType = config.coverageTypes?.find(
    (candidate) => candidate.code === coverage.coverageType,
  );
  const fixedPlan = product.ratingEngine === 'FIXED_PLAN';
  const items: (FieldItem | false | undefined)[] = [
    plan && { key: 'plan', label: 'Plan', value: plan.name },
    fixedPlan &&
      coverage.termMonths !== undefined && {
        key: 'term',
        label: 'Coverage period',
        value: formatTerm(coverage.termMonths),
      },
    coverageType && { key: 'type', label: 'Coverage type', value: coverageType.name },
    plan?.additionalCover && {
      key: 'additional',
      label: 'Additional cover',
      value: coverage.additionalCover ? plan.additionalCover.name : 'Not included',
    },
    {
      key: 'start',
      label: 'Cover starts',
      value: coverage.startDate ? coverage.startDate.format('DD MMM YYYY') : 'On issue',
    },
  ];
  return [
    ...items.filter((item): item is FieldItem => Boolean(item)),
    ...riskDetailItems(toQuoteOptions(product, coverage).riskDetails, config.riskFields),
  ];
}

/** Sticky panel beside every step: what has been chosen so far and the live quote. */
function QuotationSummary({
  product,
  participant,
  quote,
}: {
  product: Product | null;
  participant: ParticipantMatch | null;
  quote?: IndicativeQuote;
}) {
  return (
    <div className="wizard-summary">
      <Card title="Quotation summary" className="content-card">
        <FieldGrid
          columns={1}
          items={[
            {
              key: 'product',
              label: 'Product',
              value: product && `${product.name} (${product.code})`,
            },
            {
              key: 'participant',
              label: 'Participant',
              value: participant && `${participant.fullName} · ${participant.participantNo}`,
            },
          ]}
        />
        {quote && (
          <div className="wizard-summary__quote">
            <h3 className="wizard-summary__heading">Indicative contribution</h3>
            <QuotePreview quote={quote} />
          </div>
        )}
      </Card>
    </div>
  );
}

interface FrameProps {
  step: number;
  children: ReactNode;
  actions: ReactNode;
  onBack?(): void;
  summary: ReactNode;
}

/** Step indicator, step content and the action bar, with the summary panel on the right. */
function WizardFrame({ step, children, actions, onBack, summary }: FrameProps) {
  const navigate = useNavigate();
  return (
    <Row gutter={16}>
      <Col xs={24} xl={17}>
        <Card className="content-card">
          <Steps current={step} items={STEPS} size="small" className="wizard-steps" />
          {children}
          <ActionBar start={<Button onClick={() => navigate('/portal/policies')}>Cancel</Button>}>
            {onBack && <Button onClick={onBack}>Back</Button>}
            {actions}
          </ActionBar>
        </Card>
      </Col>
      <Col xs={24} xl={7}>
        {summary}
      </Col>
    </Row>
  );
}

function SelectedParticipant({
  participant,
  onChange,
}: {
  participant: ParticipantMatch;
  onChange?(): void;
}) {
  return (
    <div className="selected-record">
      <FieldGrid columns={4} items={participantItems(participant)} />
      {onChange && <Button onClick={onChange}>Change</Button>}
    </div>
  );
}

interface CoverageStepProps {
  product: Product;
  participant: ParticipantMatch;
  initialValues: CoverageValues;
  onBack(values: CoverageValues): void;
  onReview(values: CoverageValues): void;
}

/** Step 3: product-driven coverage form; the summary shows the live indicative quote. */
function CoverageStep({
  product,
  participant,
  initialValues,
  onBack,
  onReview,
}: CoverageStepProps) {
  const [form] = Form.useForm<CoverageValues>();
  const values = Form.useWatch([], form);
  const quote = useIndicativeQuote(product, participant.id, values);
  const quoted = Boolean(quote.query.data) && !quote.query.error && !quote.query.isFetching;

  const review = () =>
    form.validateFields().then(
      () => onReview(form.getFieldsValue(true)),
      () => undefined,
    );

  return (
    <WizardFrame
      step={2}
      onBack={() => onBack(form.getFieldsValue(true))}
      actions={
        <Button type="primary" disabled={!quoted} onClick={() => void review()}>
          Review
        </Button>
      }
      summary={<QuotationSummary product={product} participant={participant} quote={quote} />}
    >
      <CoverageForm product={product} form={form} initialValues={initialValues} />
    </WizardFrame>
  );
}

/** Step 4: summary of the quotation before it is saved. */
function ReviewStep({
  product,
  participant,
  coverage,
  onBack,
}: {
  product: Product;
  participant: ParticipantMatch;
  coverage: CoverageValues;
  onBack(): void;
}) {
  const navigate = useNavigate();
  const quote = useIndicativeQuote(product, participant.id, coverage);
  const options = toQuoteOptions(product, coverage);
  const save = useApiMutation(
    (request: QuoteRequest) =>
      api.post<{ id: string; quotationNo: string }>('/portal/policies', request),
    {
      success: 'Quotation saved',
      invalidate: ['/portal/policies', '/portal/dashboard'],
      onSuccess: (created) => navigate(`/portal/policies/${created.id}`),
    },
  );

  return (
    <WizardFrame
      step={3}
      onBack={onBack}
      actions={
        <Button
          type="primary"
          loading={save.isPending}
          onClick={() =>
            save.mutate({ productId: product.id, participantId: participant.id, ...options })
          }
        >
          Save quotation
        </Button>
      }
      summary={<QuotationSummary product={product} participant={participant} quote={quote} />}
    >
      <section className="form-section">
        <div className="form-section__head">
          <h3 className="form-section__title">Participant</h3>
        </div>
        <FieldGrid columns={4} items={participantItems(participant)} />
      </section>
      <section className="form-section">
        <div className="form-section__head">
          <h3 className="form-section__title">Coverage</h3>
        </div>
        <FieldGrid
          columns={3}
          items={[
            { key: 'product', label: 'Product', value: product.name },
            ...coverageItems(product, coverage),
          ]}
        />
      </section>
      <ErrorAlert error={save.error} className="mb-16" />
    </WizardFrame>
  );
}

/** AP-17..20, FFR01..05: product, participant, coverage with a live indicative quote, then save the quotation. */
export default function QuotationWizardPage() {
  const location = useLocation();
  const products = useApiQuery<Product[]>('/common/products');
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [participant, setParticipant] = useState<ParticipantMatch | null>(() =>
    presetParticipant(location.state),
  );
  const [coverage, setCoverage] = useState<CoverageValues | null>(null);

  const chooseProduct = (next: Product) => {
    if (next.id === product?.id) return;
    setProduct(next);
    setCoverage(null);
  };
  const summary = <QuotationSummary product={product} participant={participant} />;

  return (
    <>
      <PageHeader
        title="New quotation"
        breadcrumb={[
          { title: 'Home', to: '/portal' },
          { title: 'Quotations & policies', to: '/portal/policies' },
          { title: 'New quotation' },
        ]}
      />

      {step === 0 && (
        <WizardFrame
          step={0}
          summary={summary}
          actions={
            <Button type="primary" disabled={!product} onClick={() => setStep(1)}>
              Next
            </Button>
          }
        >
          <QueryState query={products}>
            {(items) => (
              <ProductChooser products={items} value={product?.id} onChange={chooseProduct} />
            )}
          </QueryState>
        </WizardFrame>
      )}

      {step === 1 && (
        <WizardFrame
          step={1}
          summary={summary}
          onBack={() => setStep(0)}
          actions={
            <Button
              type="primary"
              disabled={!participant || participant.amlStatus === 'REJECTED'}
              onClick={() => setStep(2)}
            >
              Next
            </Button>
          }
        >
          {participant ? (
            <>
              <SelectedParticipant
                participant={participant}
                onChange={() => setParticipant(null)}
              />
              <AmlOutcome status={participant.amlStatus} className="mb-16" />
            </>
          ) : (
            <ParticipantPicker onSelect={setParticipant} />
          )}
        </WizardFrame>
      )}

      {step === 2 && product && participant && (
        <CoverageStep
          key={product.id}
          product={product}
          participant={participant}
          initialValues={coverage ?? initialCoverage(product)}
          onBack={(values) => {
            setCoverage(values);
            setStep(1);
          }}
          onReview={(values) => {
            setCoverage(values);
            setStep(3);
          }}
        />
      )}

      {step === 3 && product && participant && coverage && (
        <ReviewStep
          product={product}
          participant={participant}
          coverage={coverage}
          onBack={() => setStep(2)}
        />
      )}
    </>
  );
}
