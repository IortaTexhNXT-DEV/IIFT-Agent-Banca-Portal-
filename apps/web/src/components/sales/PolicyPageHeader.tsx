import { Flex } from 'antd';
import type { ReactNode } from 'react';
import type { PolicyDetail } from '../../api/types';
import { PageHeader } from '../PageHeader';
import { StatusTag } from '../StatusTag';
import { policyReference } from './options';
import { useSalesLinks } from './useSalesLinks';

/** Policy / quotation number with workflow and payment status, product and participant. */
export function PolicyPageHeader({ policy, actions }: { policy: PolicyDetail; actions?: ReactNode }) {
  const { backoffice } = useSalesLinks();
  const breadcrumb = backoffice
    ? [{ title: 'Home', to: '/backoffice' }, { title: 'Policies', to: '/backoffice/policies' }]
    : [{ title: 'Home', to: '/portal' }, { title: 'Quotations & policies', to: '/portal/policies' }];
  const reference = policyReference(policy);

  return (
    <PageHeader
      title={
        <Flex align="center" gap={8} wrap>
          {reference}
          <StatusTag status={policy.status} />
          {policy.status !== 'CANCELLED' && <StatusTag status={policy.paymentStatus} />}
        </Flex>
      }
      subtitle={`${policy.product.name} · ${policy.participant.fullName}${policy.policyNo ? ` · quotation ${policy.quotationNo}` : ''}`}
      breadcrumb={[...breadcrumb, { title: reference }]}
      extra={actions}
    />
  );
}
