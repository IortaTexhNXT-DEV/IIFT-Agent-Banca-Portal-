import { Checkbox, Col, DatePicker, Form, type FormInstance, Input, InputNumber, Radio, Row, Switch, Typography } from 'antd';
import type { Rule } from 'antd/es/form';
import dayjs, { type Dayjs } from 'dayjs';
import type { QuoteOptions } from '../../api/sales-types';
import type { PolicyDetail, Product, ProductPlan, RiskField } from '../../api/types';
import { formatMoney } from '../../utils/format';
import { formatTerm, ISO_DATE } from './options';

type RiskValue = string | number | boolean | Dayjs | null | undefined;

export interface CoverageValues {
  planCode?: string;
  termMonths?: number;
  coverageType?: string;
  additionalCover?: boolean;
  startDate?: Dayjs | null;
  riskDetails?: Record<string, RiskValue>;
}

function isRequired(field: RiskField): boolean {
  return field.required !== false || field.mustBeTrue === true;
}

function hasValue(value: RiskValue): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** Converts the form values into the request body shared by calculate, create and update. */
export function toQuoteOptions(product: Product, values: CoverageValues): QuoteOptions {
  const riskDetails: QuoteOptions['riskDetails'] = {};
  for (const field of product.config.riskFields ?? []) {
    const value = values.riskDetails?.[field.key];
    if (!hasValue(value)) continue;
    riskDetails[field.key] = dayjs.isDayjs(value) ? value.format(ISO_DATE) : (value as string | number | boolean);
  }
  const options: QuoteOptions = { riskDetails, startDate: values.startDate?.format(ISO_DATE) };
  if (product.ratingEngine === 'FIXED_PLAN') {
    const plan = product.config.plans?.find((candidate) => candidate.code === values.planCode);
    options.planCode = values.planCode;
    options.termMonths = values.termMonths;
    options.coverageType = values.coverageType;
    options.additionalCover = Boolean(plan?.additionalCover && values.additionalCover);
  }
  return options;
}

/** True once every input the rating engine needs has a value, so an indicative quote is meaningful. */
export function isCoverageComplete(product: Product, values: CoverageValues | undefined): boolean {
  if (!values) return false;
  const { config } = product;
  if (product.ratingEngine === 'FIXED_PLAN') {
    if (!values.planCode || !values.termMonths) return false;
    if ((config.coverageTypes?.length ?? 0) > 0 && !values.coverageType) return false;
  }
  return (config.riskFields ?? []).filter(isRequired).every((field) => hasValue(values.riskDetails?.[field.key]));
}

/** Starting values for a new quotation: first term, and booleans answered "no" until confirmed. */
export function initialCoverage(product: Product): CoverageValues {
  const riskDetails: Record<string, RiskValue> = {};
  for (const field of product.config.riskFields ?? []) {
    if (field.type === 'boolean') riskDetails[field.key] = false;
  }
  const plans = product.config.plans ?? [];
  return {
    planCode: plans.length === 1 ? plans[0].code : undefined,
    termMonths: product.config.terms?.[0],
    coverageType: product.config.coverageTypes?.[0]?.code,
    additionalCover: false,
    riskDetails,
  };
}

/** Form values of a saved quotation, for editing its coverage. */
export function coverageFromPolicy(policy: PolicyDetail): CoverageValues {
  const riskDetails: Record<string, RiskValue> = {};
  for (const field of policy.product.config.riskFields ?? []) {
    const value = policy.riskDetails[field.key];
    riskDetails[field.key] = field.type === 'date' && typeof value === 'string' ? dayjs(value) : value;
  }
  return {
    planCode: policy.planCode ?? undefined,
    termMonths: policy.termMonths,
    coverageType: policy.coverageType ?? undefined,
    additionalCover: policy.riskDetails.additionalCover === true,
    startDate: policy.startDate ? dayjs(policy.startDate) : null,
    riskDetails,
  };
}

function PlanOption({ plan, terms }: { plan: ProductPlan; terms: number[] }) {
  return (
    <div className="choice-card__body">
      <div className="choice-card__title">{plan.name}</div>
      <div>Sum covered {formatMoney(plan.sumCovered)}</div>
      <div className="muted">{terms.map((term) => `${formatMoney(plan.contributions[String(term)])} / ${formatTerm(term)}`).join(' · ')}</div>
      {plan.additionalCover && <div className="muted">Additional cover +{formatMoney(plan.additionalCover.amount)}</div>}
    </div>
  );
}

function RiskFieldInput({ field }: { field: RiskField }) {
  const name = ['riskDetails', field.key];
  const rules: Rule[] = isRequired(field) && !field.mustBeTrue ? [{ required: true, message: `${field.label} is required` }] : [];

  if (field.type === 'boolean' && field.mustBeTrue) {
    return (
      <Form.Item
        name={name}
        valuePropName="checked"
        rules={[{ validator: (_, value: boolean) => (value ? Promise.resolve() : Promise.reject(new Error(`Eligibility: ${field.label} must be confirmed`))) }]}
        extra="Required for eligibility"
      >
        <Checkbox>{field.label}</Checkbox>
      </Form.Item>
    );
  }
  if (field.type === 'boolean') {
    return (
      <Form.Item name={name} label={field.label} rules={rules}>
        <Radio.Group options={[{ value: true, label: 'Yes' }, { value: false, label: 'No' }]} />
      </Form.Item>
    );
  }
  if (field.type === 'number') {
    return (
      <Form.Item name={name} label={field.label} rules={[...rules, { type: 'number', min: field.min, max: field.max, message: rangeMessage(field) }]}>
        <InputNumber className="full-width" min={field.min} max={field.max} />
      </Form.Item>
    );
  }
  if (field.type === 'date') {
    return (
      <Form.Item name={name} label={field.label} rules={rules}>
        <DatePicker className="full-width" format="DD MMM YYYY" />
      </Form.Item>
    );
  }
  return (
    <Form.Item name={name} label={field.label} rules={[...rules, { whitespace: true, message: `${field.label} is required` }]}>
      <Input maxLength={200} />
    </Form.Item>
  );
}

function rangeMessage(field: RiskField): string {
  if (field.min !== undefined && field.max !== undefined) return `Enter a value between ${field.min} and ${field.max}`;
  if (field.min !== undefined) return `Enter at least ${field.min}`;
  return `Enter at most ${field.max}`;
}

interface Props {
  product: Product;
  form: FormInstance<CoverageValues>;
  initialValues: CoverageValues;
}

/**
 * Coverage inputs generated from the product configuration (FFR01..05): plan, term,
 * coverage type and additional cover for fixed plans; financing details and any other
 * product risk fields; optional cover start date.
 */
export function CoverageForm({ product, form, initialValues }: Props) {
  const { config } = product;
  const plans = config.plans ?? [];
  const terms = config.terms ?? [];
  const coverageTypes = config.coverageTypes ?? [];
  const planCode = Form.useWatch('planCode', form);
  const selectedPlan = plans.find((plan) => plan.code === planCode);

  return (
    <Form form={form} layout="vertical" requiredMark="optional" initialValues={initialValues}>
      {product.ratingEngine === 'FIXED_PLAN' && (
        <>
          <Form.Item name="planCode" label="Plan" rules={[{ required: true, message: 'Choose a plan' }]}>
            <Radio.Group className="choice-cards">
              {plans.map((plan) => (
                <Radio key={plan.code} value={plan.code} className="choice-card">
                  <PlanOption plan={plan} terms={terms} />
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="termMonths" label="Coverage period" rules={[{ required: true, message: 'Choose the coverage period' }]}>
                <Radio.Group optionType="button" options={terms.map((term) => ({ value: term, label: formatTerm(term) }))} />
              </Form.Item>
            </Col>
            {coverageTypes.length > 0 && (
              <Col xs={24} md={12}>
                <Form.Item name="coverageType" label="Coverage type" rules={[{ required: true, message: 'Choose the coverage type' }]}>
                  <Radio.Group optionType="button" options={coverageTypes.map((type) => ({ value: type.code, label: type.name }))} />
                </Form.Item>
              </Col>
            )}
          </Row>
          {selectedPlan?.additionalCover && (
            <Form.Item name="additionalCover" label="Additional cover" valuePropName="checked" extra={`${selectedPlan.additionalCover.name}, +${formatMoney(selectedPlan.additionalCover.amount)}`}>
              <Switch checkedChildren="Included" unCheckedChildren="Not included" />
            </Form.Item>
          )}
        </>
      )}

      {(config.riskFields ?? []).length > 0 && (
        <>
          <Typography.Title level={5} className="form-section-title">
            {product.ratingEngine === 'FINANCING' ? 'Financing details' : 'Risk details'}
          </Typography.Title>
          <Row gutter={16}>
            {(config.riskFields ?? []).map((field) => (
              <Col key={field.key} xs={24} md={12}>
                <RiskFieldInput field={field} />
              </Col>
            ))}
          </Row>
        </>
      )}

      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="startDate" label="Cover start date" extra="Leave empty to start cover on the date of issue">
            <DatePicker className="full-width" format="DD MMM YYYY" disabledDate={(date) => date.isBefore(dayjs(), 'day')} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );
}
