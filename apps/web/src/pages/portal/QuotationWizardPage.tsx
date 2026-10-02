import { Alert, Button, Card, Col, Descriptions, Flex, Form, Row, Steps } from 'antd';
import { type ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ParticipantMatch, QuoteRequest } from '../../api/sales-types';
import type { Product } from '../../api/types';
import { ErrorAlert } from '../../components/ErrorAlert';
import { PageHeader } from '../../components/PageHeader';
import { QueryState } from '../../components/QueryState';
import { StatusTag } from '../../components/StatusTag';
import { AmlOutcome } from '../../components/sales/AmlOutcome';
import { type CoverageValues, CoverageForm, initialCoverage, toQuoteOptions } from '../../components/sales/CoverageForm';
import { formatTerm } from '../../components/sales/options';
import { ParticipantPicker } from '../../components/sales/ParticipantPicker';
import { ProductChooser } from '../../components/sales/ProductChooser';
import { QuotePreview, useIndicativeQuote } from '../../components/sales/QuotePreview';
import { riskDetailItems } from '../../components/sales/RiskDetails';
import '../../styles/sales.css';

const STEPS = [
  { title: 'Product', content: 'Choose the plan' },
  { title: 'Participant', content: 'Find or register' },
  { title: 'Coverage', content: 'Indicative quote' },
  { title: 'Save', content: 'Review the quotation' },
];

/** A participant passed in router state, e.g. from the participant page's "New quotation" action. */
function presetParticipant(state: unknown): ParticipantMatch | null {
  if (state && typeof state === 'object' && 'participant' in state) {
    return (state as { participant: ParticipantMatch }).participant;
  }
  return null;
}

function WizardFooter({ onBack, next }: { onBack?(): void; next: ReactNode }) {
  return (
    <Flex justify="space-between" className="wizard-footer">
      <Button disabled={!onBack} onClick={onBack}>
        Back
      </Button>
      {next}
    </Flex>
  );
}

function ParticipantSummary({ participant, onChange }: { participant: ParticipantMatch; onChange?(): void }) {
  return (
    <Card size="small" title="Participant" extra={onChange && <Button onClick={onChange}>Change participant</Button>} className="content-card">
      <Descriptions
        size="small"
        column={{ xs: 1, md: 4 }}
        items={[
          { key: 'name', label: 'Name', children: participant.fullName },
          { key: 'no', label: 'Participant no.', children: participant.participantNo },
          { key: 'id', label: 'ID', children: participant.idNumberMasked },
          { key: 'aml', label: 'AML', children: <StatusTag status={participant.amlStatus} /> },
        ]}
      />
    </Card>
  );
}

interface CoverageStepProps {
  product: Product;
  participant: ParticipantMatch;
  initialValues: CoverageValues;
  onBack(values: CoverageValues): void;
  onReview(values: CoverageValues): void;
}

/** Step 3: product-driven coverage form beside the live indicative quote. */
function CoverageStep({ product, participant, initialValues, onBack, onReview }: CoverageStepProps) {
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
    <>
      <Row gutter={[24, 16]}>
        <Col xs={24} xl={14}>
          <CoverageForm product={product} form={form} initialValues={initialValues} />
        </Col>
        <Col xs={24} xl={10}>
          <Card size="small" title="Indicative quote" className="quote-panel">
            <QuotePreview quote={quote} />
          </Card>
        </Col>
      </Row>
      <WizardFooter
        onBack={() => onBack(form.getFieldsValue(true))}
        next={
          <Button type="primary" disabled={!quoted} onClick={() => void review()}>
            Review
          </Button>
        }
      />
    </>
  );
}

function CoverageSummary({ product, coverage }: { product: Product; coverage: CoverageValues }) {
  const plan = product.config.plans?.find((candidate) => candidate.code === coverage.planCode);
  const coverageType = product.config.coverageTypes?.find((candidate) => candidate.code === coverage.coverageType);
  return (
    <Descriptions
      size="small"
      column={{ xs: 1, md: 2 }}
      items={[
        { key: 'product', label: 'Product', children: product.name },
        ...(plan ? [{ key: 'plan', label: 'Plan', children: plan.name }] : []),
        ...(coverage.termMonths && product.ratingEngine === 'FIXED_PLAN' ? [{ key: 'term', label: 'Coverage period', children: formatTerm(coverage.termMonths) }] : []),
        ...(coverageType ? [{ key: 'type', label: 'Coverage type', children: coverageType.name }] : []),
        ...(plan?.additionalCover ? [{ key: 'additional', label: 'Additional cover', children: coverage.additionalCover ? plan.additionalCover.name : 'Not included' }] : []),
        { key: 'start', label: 'Cover starts', children: coverage.startDate ? coverage.startDate.format('DD MMM YYYY') : 'On the date of issue' },
        ...riskDetailItems(toQuoteOptions(product, coverage).riskDetails, product.config.riskFields),
      ]}
    />
  );
}

/** Step 4: summary of the quotation before it is saved. */
function ReviewStep({ product, participant, coverage, onBack }: { product: Product; participant: ParticipantMatch; coverage: CoverageValues; onBack(): void }) {
  const navigate = useNavigate();
  const quote = useIndicativeQuote(product, participant.id, coverage);
  const options = toQuoteOptions(product, coverage);
  const save = useApiMutation((request: QuoteRequest) => api.post<{ id: string; quotationNo: string }>('/portal/policies', request), {
    success: 'Quotation saved',
    invalidate: ['/portal/policies', '/portal/dashboard'],
    onSuccess: (created) => navigate(`/portal/policies/${created.id}`),
  });

  return (
    <>
      <ParticipantSummary participant={participant} />
      <Row gutter={[16, 0]}>
        <Col xs={24} xl={14}>
          <Card size="small" title="Coverage" className="content-card">
            <CoverageSummary product={product} coverage={coverage} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card size="small" title="Indicative quote" className="content-card">
            <QuotePreview quote={quote} />
          </Card>
        </Col>
      </Row>
      <Alert
        type="info"
        showIcon
        className="mb-16"
        title="Next: complete the application"
        description="After saving, answer the declarations, add nominees where required, upload the documents and collect signatures before submitting."
      />
      <ErrorAlert error={save.error} className="mb-16" />
      <WizardFooter
        onBack={onBack}
        next={
          <Button type="primary" loading={save.isPending} onClick={() => save.mutate({ productId: product.id, participantId: participant.id, ...options })}>
            Save quotation
          </Button>
        }
      />
    </>
  );
}

/** AP-17..20, FFR01..05: product, participant, coverage with a live indicative quote, then save the quotation. */
export default function QuotationWizardPage() {
  const location = useLocation();
  const products = useApiQuery<Product[]>('/common/products');
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState<Product | null>(null);
  const [participant, setParticipant] = useState<ParticipantMatch | null>(() => presetParticipant(location.state));
  const [coverage, setCoverage] = useState<CoverageValues | null>(null);

  const chooseProduct = (next: Product) => {
    if (next.id === product?.id) return;
    setProduct(next);
    setCoverage(null);
  };

  return (
    <>
      <PageHeader title="New quotation" breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'Quotations & policies', to: '/portal/policies' }, { title: 'New quotation' }]} />
      <Card className="content-card">
        <Steps current={step} items={STEPS} className="wizard-steps" />

        {step === 0 && (
          <>
            <QueryState query={products}>{(items) => <ProductChooser products={items} value={product?.id} onChange={chooseProduct} />}</QueryState>
            <WizardFooter
              next={
                <Button type="primary" disabled={!product} onClick={() => setStep(1)}>
                  Next
                </Button>
              }
            />
          </>
        )}

        {step === 1 && (
          <>
            {participant ? (
              <>
                <ParticipantSummary participant={participant} onChange={() => setParticipant(null)} />
                <AmlOutcome status={participant.amlStatus} />
              </>
            ) : (
              <ParticipantPicker onSelect={setParticipant} />
            )}
            <WizardFooter
              onBack={() => setStep(0)}
              next={
                <Button type="primary" disabled={!participant || participant.amlStatus === 'REJECTED'} onClick={() => setStep(2)}>
                  Next
                </Button>
              }
            />
          </>
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

        {step === 3 && product && participant && coverage && <ReviewStep product={product} participant={participant} coverage={coverage} onBack={() => setStep(2)} />}
      </Card>
    </>
  );
}
