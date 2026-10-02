import { useApiQuery } from '../../api/hooks';
import type { CodeItem } from '../../api/types';

/** Active master-data codes of one category as Select options plus a code -> label lookup. */
export function useCodes(category: string) {
  const query = useApiQuery<CodeItem[]>('/common/codes', { category });
  const items = query.data ?? [];
  const labels = new Map(items.map((item) => [item.code, item.label]));
  return {
    loading: query.isLoading,
    options: items.map((item) => ({ value: item.code, label: item.label })),
    label: (code: string | null | undefined) => (code ? (labels.get(code) ?? code) : '–'),
  };
}
