import { keepPreviousData, useMutation, type UseMutationOptions, useQuery, useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useState } from 'react';
import { api, ApiError } from './client';
import type { Page } from './types';

type Params = Record<string, string | number | boolean | undefined | null>;

/** GET with caching; the key is derived from the path and parameters. */
export function useApiQuery<T>(path: string | null, params?: Params, options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: [path, params],
    queryFn: () => api.get<T>(path!, params),
    enabled: path !== null,
    refetchInterval: options.refetchInterval,
  });
}

/** Server-side paginated list bound to an antd Table. */
export function usePagedQuery<T>(path: string, filters: Params = {}, pageSize = 20) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);
  const query = useQuery({
    queryKey: [path, filters, page, size],
    queryFn: () => api.get<Page<T>>(path, { ...filters, page, pageSize: size }),
    placeholderData: keepPreviousData,
  });
  return {
    ...query,
    items: query.data?.items ?? [],
    pagination: {
      current: page,
      pageSize: size,
      total: query.data?.total ?? 0,
      showSizeChanger: true,
      showTotal: (total: number) => `${total} record${total === 1 ? '' : 's'}`,
      onChange: (nextPage: number, nextSize: number) => {
        setPage(nextSize === size ? nextPage : 1);
        setSize(nextSize);
      },
    },
    resetPage: () => setPage(1),
  };
}

/**
 * Mutation that shows a success message, reports errors consistently and refreshes the
 * affected queries. `invalidate` lists path prefixes whose cached data is now stale.
 */
export function useApiMutation<TVariables, TResult = unknown>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options: { success?: string; invalidate?: string[] } & Omit<UseMutationOptions<TResult, ApiError, TVariables>, 'mutationFn'> = {},
) {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const { success, invalidate, onSuccess, ...rest } = options;
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn,
    ...rest,
    onSuccess: async (data, variables, result, context) => {
      if (success) message.success(success);
      if (invalidate) {
        await Promise.all(
          invalidate.map((prefix) =>
            queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && (query.queryKey[0] as string).startsWith(prefix) }),
          ),
        );
      }
      await onSuccess?.(data, variables, result, context);
    },
  });
}
