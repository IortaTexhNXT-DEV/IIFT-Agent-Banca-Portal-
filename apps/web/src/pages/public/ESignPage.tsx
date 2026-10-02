import {
  Button,
  Card,
  Checkbox,
  Descriptions,
  Form,
  Input,
  Result,
  Skeleton,
  Typography,
} from 'antd';
import { type ReactNode, useState } from 'react';
import { useParams } from 'react-router';
import { api, ApiError } from '../../api/client';
import { useApiMutation, useApiQuery } from '../../api/hooks';
import type { ESignSummary } from '../../api/sales-types';
import { ErrorAlert } from '../../components/ErrorAlert';
import { Money } from '../../components/Money';
import { SignaturePad } from '../../components/SignaturePad';
import { formatTerm } from '../../components/sales/options';
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
        label="Your full name"
        extra={`Type your name exactly as shown: ${summary.participantName}`}
        rules={[
          { required: true, whitespace: true, message: 'Type your full name' },
          { min: 2, max: 150 },
        ]}
      >
        <Input autoComplete="name" maxLength={150} />
      </Form.Item>
      <Form.Item
        name="consent"
        valuePropName="checked"
        rules={[
          {
            validator: (_, value: boolean) =>
              value
                ? Promise.resolve()
                : Promise.reject(new Error('Please confirm the declaration')),
          },
        ]}
      >
        <Checkbox>{DECLARATION}</Checkbox>
      </Form.Item>
      <Form.Item
        label="Signature"
        required
        validateStatus={signatureMissing ? 'error' : undefined}
        help={signatureMissing ? 'Please sign in the box' : undefined}
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
    <Descriptions
      size="small"
      column={1}
      bordered
      className="mb-16"
      items={[
        { key: 'quotation', label: 'Quotation no.', children: summary.quotationNo },
        { key: 'participant', label: 'Participant', children: summary.participantName },
        { key: 'product', label: 'Product', children: summary.product },
        ...(summary.plan ? [{ key: 'plan', label: 'Plan', children: summary.plan }] : []),
        { key: 'term', label: 'Period of cover', children: formatTerm(summary.termMonths) },
        { key: 'sum', label: 'Sum covered', children: <Money value={summary.sumCovered} /> },
        {
          key: 'contribution',
          label: 'Contribution',
          children: <Money value={summary.contribution} strong />,
        },
        { key: 'agent', label: 'Your agent', children: summary.agentName },
        { key: 'expires', label: 'Link valid until', children: formatDateTime(summary.expiresAt) },
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

  let content: ReactNode;
  if (signed) {
    content = (
      <Result
        status="success"
        title="Thank you, your application is signed"
        subTitle="Your agent has been notified and will complete the submission. You can close this page."
      />
    );
  } else if (summary.isLoading) {
    content = <Skeleton active paragraph={{ rows: 8 }} />;
  } else if (invalid) {
    content = (
      <Result
        status="warning"
        title="This link is no longer valid"
        subTitle="It may have expired or already been used. Please contact your agent for a new e-signature link."
      />
    );
  } else if (summary.error || !summary.data) {
    content = <ErrorAlert error={summary.error} />;
  } else {
    content = (
      <>
        <Typography.Title level={4}>Review and sign your application</Typography.Title>
        <Typography.Paragraph type="secondary">
          Please check the details below before signing. Contact your agent if anything is
          incorrect.
        </Typography.Paragraph>
        <Summary summary={summary.data} />
        <SignForm token={token} summary={summary.data} onSigned={() => setSigned(true)} />
      </>
    );
  }

  return (
    <main className="public-page">
      <div className="public-page__card">
        <img
          src="/iift-logo.png"
          alt="Insurans Islam Family Takaful"
          className="public-page__logo"
        />
        <Card>{content}</Card>
        <p className="public-page__footer">Insurans Islam Family Takaful Sendirian Berhad</p>
      </div>
    </main>
  );
}
