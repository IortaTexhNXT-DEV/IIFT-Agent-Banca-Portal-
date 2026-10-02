import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Alert, Descriptions, Empty, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { QuoteRequest } from '../../api/sales-types';
import type { Product, QuoteResult } from '../../api/types';
import { ErrorAlert } from '../ErrorAlert';
import { Money } from '../Money';
import { ContributionBreakdown } from './ContributionBreakdown';
import { type CoverageValues, isCoverageComplete, toQuoteOptions } from './CoverageForm';
import { formatTerm } from './options';

const DEBOUNCE_MS = 500;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Indicative quote (AP-18/19): recalculated by the rating engine shortly after the agent
 * stops typing, once every input the engine needs has a value.
 */
export function useIndicativeQuote(product: Product, participantId: string, values: CoverageValues | undefined) {
  const complete = isCoverageComplete(product, values);
  const request: QuoteRequest | null = complete && values ? { productId: product.id, participantId, ...toQuoteOptions(product, values) } : null;
  const debounced = useDebounced(request === null ? null : JSON.stringify(request), DEBOUNCE_MS);
  const query = useQuery({
    queryKey: ['/portal/policies/calculate', debounced],
    queryFn: () => api.post<QuoteResult>('/portal/policies/calculate', JSON.parse(debounced ?? '{}') as QuoteRequest),
    enabled: debounced !== null && request !== null,
    placeholderData: keepPreviousData,
  });
  return { complete, query };
}

type IndicativeQuote = ReturnType<typeof useIndicativeQuote>;

/** Result panel: contribution, Tabarru'/Wakalah split, referral reasons and eligibility errors. */
export function QuotePreview({ quote }: { quote: IndicativeQuote }) {
  const { complete, query } = quote;
  if (!complete) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Complete the coverage details to see the indicative contribution" />;
  }
  if (query.error instanceof ApiError && query.error.status === 422) {
    return (
      <Alert
        type="error"
        showIcon
        title="Not eligible as entered"
        description={
          <ul className="plain-list">
            {query.error.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        }
      />
    );
  }
  if (query.error) {
    return <ErrorAlert error={query.error} />;
  }
  if (!query.data) {
    return <Spin description="Calculating" className="quote-preview__loading" />;
  }
  const result = query.data;
  return (
    <Spin spinning={query.isFetching} description="Recalculating">
      <Descriptions
        size="small"
        column={1}
        className="mb-16"
        items={[
          { key: 'sum', label: 'Sum covered', children: <Money value={result.sumCovered} strong /> },
          { key: 'term', label: 'Term', children: formatTerm(result.termMonths) },
          { key: 'contribution', label: 'Contribution', children: <Money value={result.contribution} strong /> },
        ]}
      />
      <ContributionBreakdown lines={result.lines} contribution={result.contribution} tabarru={result.tabarru} wakalahFee={result.wakalahFee} />
      {result.referralReasons.length > 0 && (
        <Alert
          className="mt-16"
          type="warning"
          showIcon
          title="This case will be referred to IIFT"
          description={
            <ul className="plain-list">
              {result.referralReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          }
        />
      )}
    </Spin>
  );
}
