import type { ReactNode } from 'react';
import type { PolicyDetail } from '../../api/types';
import { PageHeader } from '../PageHeader';
import { StatusTag } from '../StatusTag';
import { policyReference } from './options';
import { useSalesLinks } from './useSalesLinks';

/** Policy / quotation number with workflow and payment status, product and participant. */
export function PolicyPageHeader({
  policy,
  actions,
}: {
  policy: PolicyDetail;
  actions?: ReactNode;
}) {
  const links = useSalesLinks();
  const breadcrumb = links.backoffice
    ? [
        { title: 'Home', to: '/backoffice' },
        { title: 'Policies', to: '/backoffice/policies' },
      ]
    : [
        { title: 'Home', to: '/portal' },
        { title: 'Quotations & policies', to: '/portal/policies' },
      ];
  const reference = policyReference(policy);

  return (
    <PageHeader
      title={reference}
      tags={
        <>
          <StatusTag status={policy.status} />
          {policy.status !== 'CANCELLED' && <StatusTag status={policy.paymentStatus} />}
        </>
      }
      meta={[
        { label: 'Product', value: policy.product.name },
        { label: 'Participant', value: policy.participant.fullName },
        policy.policyNo && { label: 'Quotation', value: policy.quotationNo },
        links.backoffice && { label: 'Agency / bank', value: policy.agency.name },
      ]}
      breadcrumb={[...breadcrumb, { title: reference }]}
      extra={actions}
    />
  );
}
