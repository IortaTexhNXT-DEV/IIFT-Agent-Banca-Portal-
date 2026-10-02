import { Button, Card, Drawer, Flex, Form } from 'antd';
import { api } from '../../api/client';
import { useApiMutation } from '../../api/hooks';
import type { QuoteOptions } from '../../api/sales-types';
import type { PolicyDetail } from '../../api/types';
import { ErrorAlert } from '../ErrorAlert';
import {
  type CoverageValues,
  CoverageForm,
  coverageFromPolicy,
  toQuoteOptions,
} from './CoverageForm';
import { QuotePreview, useIndicativeQuote } from './QuotePreview';

/** AP-19: change the coverage of a draft quotation; the contribution is recalculated. */
export function CoverageDrawer({ policy, onClose }: { policy: PolicyDetail; onClose(): void }) {
  const [form] = Form.useForm<CoverageValues>();
  const values = Form.useWatch([], form);
  const quote = useIndicativeQuote(policy.product, policy.participant.id, values);
  const save = useApiMutation(
    (body: QuoteOptions) => api.put(`/portal/policies/${policy.id}`, body),
    {
      success: 'Coverage updated',
      invalidate: ['/portal/policies'],
      onSuccess: onClose,
    },
  );

  const submit = () =>
    form.validateFields().then(
      () => save.mutate(toQuoteOptions(policy.product, form.getFieldsValue(true))),
      () => undefined,
    );

  return (
    <Drawer
      open
      title={`Edit coverage – ${policy.quotationNo}`}
      size={760}
      onClose={onClose}
      destroyOnHidden
      footer={
        <Flex justify="flex-end" gap={8}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            loading={save.isPending}
            disabled={!quote.query.data || Boolean(quote.query.error)}
            onClick={() => void submit()}
          >
            Save coverage
          </Button>
        </Flex>
      }
    >
      <ErrorAlert error={save.error} className="mb-16" />
      <CoverageForm
        product={policy.product}
        form={form}
        initialValues={coverageFromPolicy(policy)}
      />
      <Card size="small" title="Indicative quote">
        <QuotePreview quote={quote} />
      </Card>
    </Drawer>
  );
}
