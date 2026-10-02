import { Button, Col, DatePicker, Drawer, Flex, Form, Input, InputNumber, Row, Select, Table, Typography, Upload, type UploadFile } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { OutstandingPolicy, Payment, PaymentMethod } from '../../api/types';
import { formatMoney } from '../../utils/format';
import { ErrorAlert } from '../ErrorAlert';
import { Money } from '../Money';
import { ISO_DATE, PAYMENT_METHOD_OPTIONS, policyReference } from './options';
import { useCodes } from './useCodes';

interface Values {
  method: PaymentMethod;
  bankName?: string;
  referenceNo: string;
  paymentDate: Dayjs;
  remarks?: string;
  amounts: Record<string, number | null>;
}

interface Props {
  policies: OutstandingPolicy[];
  onClose(): void;
  onSubmitted(payment: Payment): void;
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg';

/** AP-38..40: one payment (single or bulk) allocated across policies, with proof of payment. */
export function PaymentDrawer({ policies, onClose, onSubmitted }: Props) {
  const [form] = Form.useForm<Values>();
  const [proof, setProof] = useState<UploadFile[]>([]);
  const [proofMissing, setProofMissing] = useState(false);
  const banks = useCodes('BANK');
  const amounts = Form.useWatch('amounts', form);
  const total = policies.reduce((sum, policy) => sum + (amounts?.[policy.id] ?? 0), 0);

  const submit = useApiMutation(
    (values: Values) => {
      const data = new FormData();
      data.append('method', values.method);
      if (values.bankName) data.append('bankName', values.bankName);
      data.append('referenceNo', values.referenceNo.trim());
      data.append('paymentDate', values.paymentDate.format(ISO_DATE));
      if (values.remarks?.trim()) data.append('remarks', values.remarks.trim());
      data.append('allocations', JSON.stringify(policies.map((policy) => ({ policyId: policy.id, amount: values.amounts[policy.id] }))));
      data.append('proof', proof[0].originFileObj as File);
      return api.upload<Payment>('/portal/billing/payments', data);
    },
    { invalidate: ['/portal/billing', '/portal/policies', '/portal/dashboard'], onSuccess: onSubmitted },
  );

  const send = () => {
    setProofMissing(proof.length === 0);
    form.validateFields().then(
      (values) => {
        if (proof.length > 0) submit.mutate(values);
      },
      () => undefined,
    );
  };

  return (
    <Drawer
      open
      title={`Submit payment for ${policies.length} ${policies.length === 1 ? 'policy' : 'policies'}`}
      size={720}
      onClose={onClose}
      destroyOnHidden
      footer={
        <Flex justify="space-between" align="center">
          <Typography.Text>
            Total <Money value={total} strong />
          </Typography.Text>
          <Flex gap={8}>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" loading={submit.isPending} onClick={send}>
              Submit for verification
            </Button>
          </Flex>
        </Flex>
      }
    >
      <ErrorAlert error={submit.error} className="mb-16" />
      <Form<Values>
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          method: 'BANK_TRANSFER',
          paymentDate: dayjs(),
          amounts: Object.fromEntries(policies.map((policy) => [policy.id, Number(policy.outstandingAmount)])),
        }}
      >
        <Typography.Title level={5} className="form-section-title">
          Allocation
        </Typography.Title>
        <Table<OutstandingPolicy>
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={policies}
          className="mb-16"
          columns={[
            { title: 'Policy / quotation no.', key: 'reference', render: (_, policy) => policyReference(policy) },
            { title: 'Participant', dataIndex: ['participant', 'fullName'] },
            { title: 'Outstanding', dataIndex: 'outstandingAmount', align: 'right', render: (value: string) => <Money value={value} /> },
            {
              title: 'Amount paid',
              key: 'amount',
              width: 170,
              render: (_, policy) => (
                <Form.Item
                  name={['amounts', policy.id]}
                  className="cell-form-item"
                  rules={[
                    { required: true, message: 'Enter the amount' },
                    { type: 'number', min: 0.01, max: Number(policy.outstandingAmount), message: `Up to ${formatMoney(policy.outstandingAmount)}` },
                  ]}
                >
                  <InputNumber aria-label={`Amount paid for ${policyReference(policy)}`} className="full-width" min={0.01} max={Number(policy.outstandingAmount)} precision={2} prefix="B$" />
                </Form.Item>
              ),
            },
          ]}
        />

        <Typography.Title level={5} className="form-section-title">
          Payment details
        </Typography.Title>
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="method" label="Method" rules={[{ required: true }]}>
              <Select options={PAYMENT_METHOD_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="bankName" label="Bank">
              <Select allowClear loading={banks.loading} options={banks.options.map((bank) => ({ value: bank.label, label: bank.label }))} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="referenceNo"
              label="Bank reference"
              rules={[
                { required: true, whitespace: true, message: 'Enter the transaction or cheque reference' },
                { pattern: /^[A-Za-z0-9\-/ ]{3,50}$/, message: '3 to 50 letters, digits, spaces, - or /' },
              ]}
            >
              <Input maxLength={50} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="paymentDate" label="Payment date" rules={[{ required: true, message: 'Choose the payment date' }]}>
              <DatePicker className="full-width" format="DD MMM YYYY" disabledDate={(date) => date.isAfter(dayjs(), 'day')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="remarks" label="Remarks" rules={[{ max: 500 }]}>
          <Input.TextArea rows={2} maxLength={500} />
        </Form.Item>
        <Form.Item label="Proof of payment" required extra="Bank slip, transfer confirmation or cheque copy – PDF, PNG or JPEG" validateStatus={proofMissing ? 'error' : undefined} help={proofMissing ? 'Attach the proof of payment' : undefined}>
          <Upload.Dragger
            accept={ACCEPT}
            maxCount={1}
            fileList={proof}
            beforeUpload={() => false}
            onChange={({ fileList }) => {
              setProof(fileList.slice(-1));
              setProofMissing(false);
            }}
          >
            <p className="ant-upload-text">Click or drag the file here</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Drawer>
  );
}
