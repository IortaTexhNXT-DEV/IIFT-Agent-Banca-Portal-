import { Alert, Card, Col, Descriptions, Flex, Row, Table } from 'antd';
import type { ReactNode } from 'react';
import type { Money as MoneyValue, Payment } from '../../api/types';
import { formatDate, formatDateTime, humanise } from '../../utils/format';
import { ApprovalHistory } from '../ApprovalHistory';
import { DocumentPanel } from '../DocumentPanel';
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
    ? [{ title: 'Home', to: '/backoffice' }, { title: 'Payments', to: '/backoffice/payments' }]
    : [{ title: 'Home', to: '/portal' }, { title: 'Billing & payments', to: '/portal/billing' }];

  return (
    <>
      <PageHeader
        title={
          <Flex align="center" gap={8}>
            {payment.paymentNo}
            <StatusTag status={payment.status} />
          </Flex>
        }
        subtitle={`${payment.agency.name} · submitted ${formatDateTime(payment.createdAt)}`}
        breadcrumb={[...breadcrumb, { title: payment.paymentNo }]}
        extra={actions}
      />
      {payment.status === 'REJECTED' && (
        <Alert
          className="mb-16"
          type="error"
          showIcon
          title="Payment rejected by Finance"
          description={`${payment.rejectionReason ?? 'No reason was recorded.'} The policies are open for payment again.`}
        />
      )}
      <Row gutter={[16, 0]}>
        <Col xs={24} xl={10}>
          <Card title="Payment" className="content-card">
            <Descriptions
              size="small"
              column={1}
              items={[
                { key: 'amount', label: 'Total amount', children: <Money value={payment.totalAmount} strong /> },
                { key: 'method', label: 'Method', children: humanise(payment.method) },
                { key: 'bank', label: 'Bank', children: payment.bankName ?? '–' },
                { key: 'reference', label: 'Reference', children: payment.referenceNo },
                { key: 'date', label: 'Payment date', children: formatDate(payment.paymentDate) },
                { key: 'verified', label: 'Verified', children: formatDateTime(payment.verifiedAt) },
                { key: 'remarks', label: 'Remarks', children: payment.remarks ?? '–' },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title="Allocated to" className="content-card">
            <Table<Allocation>
              size="small"
              rowKey="id"
              pagination={false}
              dataSource={payment.allocations}
              columns={[
                { title: 'Policy / quotation no.', key: 'policy', render: (_, allocation) => <PolicyLink policy={allocation.policy} /> },
                { title: 'Participant', key: 'participant', render: (_, allocation) => allocation.policy.participant.fullName },
                { title: 'Amount', dataIndex: 'amount', align: 'right', render: (value: MoneyValue) => <Money value={value} /> },
              ]}
            />
          </Card>
          <Card title="e-Receipts" className="content-card">
            <ReceiptsTable receipts={payment.receipts} />
          </Card>
        </Col>
      </Row>
      <Card className="content-card">
        <DocumentPanel ownerType="PAYMENT" ownerId={payment.id} title="Proof of payment" />
      </Card>
      <Card title="Verification" className="content-card">
        <ApprovalHistory approvals={payment.approvals ?? []} />
      </Card>
    </>
  );
}
