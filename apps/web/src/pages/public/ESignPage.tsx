import { Button, Card, Checkbox, Form, Input, Result, Skeleton } from 'antd';
import { type ReactNode, useState } from 'react';
import { useParams } from 'react-router';
import { api, ApiError } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ESignSummary } from '../../api/sales-types';
import { PoweredBy } from '../../components/Branding';
import { ErrorAlert } from '../../components/ErrorAlert';
import { FieldGrid } from '../../components/FieldGrid';
import { Money } from '../../components/Money';
import { formatTerm } from '../../components/sales/options';
import { SignaturePad } from '../../components/SignaturePad';
import { COMPANY_NAME, COPYRIGHT_YEAR, PRODUCT_NAME } from '../../config/app';
import { formatDateTime } from '../../utils/format';
import '../../styles/sales.css';

interface Values {
  fullName: string;
  consent: boolean;
}

const DECLARATION =
  'I have read the product disclosure sheet and the quotation above. I declare that the information in my application is true and complete, and I agree to participate in the takaful scheme on these terms. I understand that this electronic signature has the same effect as my handwritten signature.';

function SignForm({
  token,
  summary,
  onSigned,
}: {
  token: string;
  summary: ESignSummary;
  onSigned(): void;
}) {
  const [form] = Form.useForm<Values>();
  const [signature, setSignature] = useState<string | null>(null);
  const [signatureMissing, setSignatureMissing] = useState(false);
  const sign = useApiMutation(
    (values: Values & { imageDataUrl: string }) =>
      api.post(`/public/esign/${token}`, { ...values, fullName: values.fullName.trim() }),
    {
      onSuccess: onSigned,
    },
  );

  const submit = (values: Values) => {
    setSignatureMissing(!signature);
    if (signature) sign.mutate({ ...values, imageDataUrl: signature });
  };

  return (
    <Form<Values> form={form} layout="vertical" requiredMark="optional" onFinish={submit}>
      <ErrorAlert error={sign.error} className="mb-16" />
      <Form.Item
        name="fullName"
        label="Full name"
        tooltip="Exactly as shown on the quotation"
        rules={[
          { required: true, whitespace: true, message: 'Type your full name' },
          { min: 2, max: 150, message: 'Between 2 and 150 characters' },
        ]}
      >
        <Input autoComplete="name" maxLength={150} placeholder={summary.participantName} />
      </Form.Item>
      <Form.Item
        name="consent"
        valuePropName="checked"
        rules={[
          {
            validator: (_, value: boolean) =>
              value ? Promise.resolve() : Promise.reject(new Error('Confirm the declaration')),
          },
        ]}
      >
        <Checkbox className="declaration">{DECLARATION}</Checkbox>
      </Form.Item>
      <Form.Item
        label="Signature"
        required
        validateStatus={signatureMissing ? 'error' : undefined}
        help={signatureMissing ? 'Signature required' : undefined}
      >
        <SignaturePad
          onChange={(value) => {
            setSignature(value);
            if (value) setSignatureMissing(false);
          }}
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" block size="large" loading={sign.isPending}>
        Sign application
      </Button>
    </Form>
  );
}

function Summary({ summary }: { summary: ESignSummary }) {
  return (
    <FieldGrid
      columns={2}
      className="public-page__summary"
      items={[
        { key: 'quotation', label: 'Quotation no.', value: summary.quotationNo },
        { key: 'participant', label: 'Participant', value: summary.participantName },
        { key: 'product', label: 'Product', value: summary.product },
        summary.plan && { key: 'plan', label: 'Plan', value: summary.plan },
        { key: 'term', label: 'Period of cover', value: formatTerm(summary.termMonths) },
        { key: 'sum', label: 'Sum covered', value: <Money value={summary.sumCovered} /> },
        {
          key: 'contribution',
          label: 'Contribution',
          value: <Money value={summary.contribution} strong />,
        },
        { key: 'agent', label: 'Your agent', value: summary.agentName },
        {
          key: 'expires',
          label: 'Link valid until',
          value: formatDateTime(summary.expiresAt),
          span: 2,
        },
      ]}
    />
  );
}

/** AP-62: public page where the participant reviews the quotation and signs from the e-mailed link. */
export default function ESignPage() {
  const { token = '' } = useParams();
  const summary = useApiQuery<ESignSummary>(`/public/esign/${token}`);
  const [signed, setSigned] = useState(false);
  const invalid =
    summary.error instanceof ApiError &&
    (summary.error.status === 404 || summary.error.code === 'LINK_INVALID');

  let title = 'Review and sign';
  let content: ReactNode;
  if (signed) {
    title = 'Application signed';
    content = (
      <Result
        status="success"
        title="Thank you, your application is signed"
        subTitle="Your agent completes the submission. You can close this page."
      />
    );
  } else if (summary.isLoading) {
    content = <Skeleton active paragraph={{ rows: 8 }} />;
  } else if (invalid) {
    title = 'Link not valid';
    content = (
      <Result
        status="warning"
        title="This link has expired or was already used"
        subTitle="Ask your agent for a new e-signature link."
      />
    );
  } else if (summary.error || !summary.data) {
    content = <ErrorAlert error={summary.error} />;
  } else {
    content = (
      <>
        <section className="form-section">
          <div className="form-section__head">
            <h3 className="form-section__title">Quotation</h3>
          </div>
          <Summary summary={summary.data} />
        </section>
        <section className="form-section">
          <div className="form-section__head">
            <h3 className="form-section__title">Signature</h3>
          </div>
          <SignForm token={token} summary={summary.data} onSigned={() => setSigned(true)} />
        </section>
      </>
    );
  }

  return (
    <div className="public-page">
      <main className="public-page__card">
        <div className="public-page__brand">
          <img
            src="/iift-logo.png"
            alt="Insurans Islam Family Takaful"
            className="public-page__logo"
          />
          <div>
            <div className="public-page__product">{PRODUCT_NAME}</div>
            <div className="public-page__org">{COMPANY_NAME}</div>
          </div>
        </div>
        <Card title={title} className="content-card">
          {content}
        </Card>
      </main>
      <footer className="public-page__footer">
        <span>
          © {COPYRIGHT_YEAR} {COMPANY_NAME}
        </span>
        <PoweredBy />
      </footer>
    </div>
  );
}
