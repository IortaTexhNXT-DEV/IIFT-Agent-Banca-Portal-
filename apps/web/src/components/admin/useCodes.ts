import { useMemo } from 'react';
import { useApiQuery } from '../../api/hooks';
import type { CodeItem } from '../../api/types';

/** Active master-data values of one category, as Select options plus a label lookup. */
export function useCodes(category: string) {
  const query = useApiQuery<CodeItem[]>('/common/codes', { category });
  return useMemo(() => {
    const items = query.data ?? [];
    const labels = new Map(items.map((item) => [item.code, item.label]));
    return {
      loading: query.isLoading,
      options: items.map((item) => ({ value: item.code, label: item.label })),
      labelOf: (code: string | null | undefined) => (code ? (labels.get(code) ?? code) : '–'),
    };
  }, [query.data, query.isLoading]);
}

/** Turns a list of enum values into Select options with readable labels. */
export function enumOptions<T extends string>(values: readonly T[], label: (value: T) => string) {
  return values.map((value) => ({ value, label: label(value) }));
}
