import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalculatorOutlined } from '@ant-design/icons';
import { Alert, Spin } from 'antd';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import type { QuoteRequest } from '../../api/sales-types';
import type { Product, QuoteResult } from '../../api/types';
import { EmptyState } from '../EmptyState';
import { ErrorAlert } from '../ErrorAlert';
import { FieldGrid } from '../FieldGrid';
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
export function useIndicativeQuote(
  product: Product,
  participantId: string,
  values: CoverageValues | undefined,
) {
  const complete = isCoverageComplete(product, values);
  const request: QuoteRequest | null =
    complete && values
      ? { productId: product.id, participantId, ...toQuoteOptions(product, values) }
      : null;
  const debounced = useDebounced(request === null ? null : JSON.stringify(request), DEBOUNCE_MS);
  const query = useQuery({
    queryKey: ['/portal/policies/calculate', debounced],
    queryFn: () =>
      api.post<QuoteResult>(
        '/portal/policies/calculate',
        JSON.parse(debounced ?? '{}') as QuoteRequest,
      ),
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
    return <EmptyState icon={<CalculatorOutlined />} label="Complete the cover details" />;
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
      <FieldGrid
        columns={2}
        className="mb-16"
        items={[
          { key: 'sum', label: 'Sum covered', value: <Money value={result.sumCovered} strong /> },
          { key: 'term', label: 'Term', value: formatTerm(result.termMonths) },
        ]}
      />
      <ContributionBreakdown
        lines={result.lines}
        contribution={result.contribution}
        tabarru={result.tabarru}
        wakalahFee={result.wakalahFee}
      />
      {result.referralReasons.length > 0 && (
        <Alert
          className="mt-16"
          type="warning"
          showIcon
          title="Referred to IIFT for approval"
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
