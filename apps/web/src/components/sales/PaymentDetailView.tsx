import { Alert, Card, Col, Row } from 'antd';
import type { ReactNode } from 'react';
import type { Payment } from '../../api/types';
import { formatDate, formatDateTime, humanise } from '../../utils/format';
import { ApprovalHistory } from '../ApprovalHistory';
import { DataTable, moneyColumn, textColumn } from '../DataTable';
import { DocumentPanel } from '../DocumentPanel';
import { EmptyState } from '../EmptyState';
import { FieldGrid } from '../FieldGrid';
import { Money } from '../Money';
import { PageHeader } from '../PageHeader';
import { StatusTag } from '../StatusTag';
import { PolicyLink } from './PolicyTable';
import { ReceiptsTable } from './ReceiptsTable';
import { useSalesLinks } from './useSalesLinks';

type Allocation = Payment['allocations'][number];

interface Props {
  payment: Payment;
  actions?: ReactNode;
}

/** A submitted payment: allocations per policy, proof, e-Receipts and verification history (AP-38..41). */
export function PaymentDetailView({ payment, actions }: Props) {
  const { backoffice } = useSalesLinks();
  const breadcrumb = backoffice
    ? [
        { title: 'Home', to: '/backoffice' },
        { title: 'Payments', to: '/backoffice/payments' },
      ]
    : [
        { title: 'Home', to: '/portal' },
        { title: 'Billing & payments', to: '/portal/billing' },
      ];

  return (
    <>
      <PageHeader
        title={payment.paymentNo}
        tags={<StatusTag status={payment.status} />}
        meta={[
          { label: 'Amount', value: <Money value={payment.totalAmount} /> },
          { label: 'Agency / bank', value: payment.agency.name },
          { label: 'Submitted', value: formatDateTime(payment.createdAt) },
        ]}
        breadcrumb={[...breadcrumb, { title: payment.paymentNo }]}
        extra={actions}
      />
      {payment.status === 'REJECTED' && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="Rejected by Finance – the policies are open for payment again"
          description={payment.rejectionReason}
        />
      )}
      <Row gutter={16}>
        <Col xs={24} xl={16}>
          <Card title="Payment" className="content-card">
            <FieldGrid
              columns={3}
              items={[
                {
                  key: 'amount',
                  label: 'Total amount',
                  value: <Money value={payment.totalAmount} strong />,
                },
                { key: 'method', label: 'Method', value: humanise(payment.method) },
                { key: 'bank', label: 'Bank', value: payment.bankName },
                { key: 'reference', label: 'Bank reference', value: payment.referenceNo },
                { key: 'date', label: 'Payment date', value: formatDate(payment.paymentDate) },
                { key: 'verified', label: 'Verified', value: formatDateTime(payment.verifiedAt) },
                { key: 'remarks', label: 'Remarks', value: payment.remarks, span: 'full' },
              ]}
            />
          </Card>
          <Card title="Allocated to" className="content-card content-card--flush">
            <DataTable<Allocation>
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={payment.allocations}
              scroll={{}}
              locale={{ emptyText: <EmptyState label="No allocations" /> }}
              columns={[
                {
                  title: 'Policy / quotation',
                  key: 'policy',
                  width: 180,
                  render: (_, allocation) => <PolicyLink policy={allocation.policy} />,
                },
                textColumn('Participant', ['policy', 'participant', 'fullName']),
                moneyColumn('Amount', 'amount', 140),
              ]}
            />
          </Card>
          <Card title="e-Receipts" className="content-card content-card--flush">
            <ReceiptsTable receipts={payment.receipts} />
          </Card>
          <Card className="content-card">
            <DocumentPanel ownerType="PAYMENT" ownerId={payment.id} title="Proof of payment" />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="Verification" className="content-card">
            <ApprovalHistory approvals={payment.approvals ?? []} />
          </Card>
        </Col>
      </Row>
    </>
  );
}
