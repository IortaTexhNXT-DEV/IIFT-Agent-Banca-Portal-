import {
  keepPreviousData,
  useMutation,
  type UseMutationOptions,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useState } from 'react';
import { type NoticeInput, useNotify } from '../components/notify';
import { api, ApiError } from './client';
import type { Page } from './types';

type Params = Record<string, string | number | boolean | undefined | null>;

/** GET with caching; the key is derived from the path and parameters. */
export function useApiQuery<T>(
  path: string | null,
  params?: Params,
  options: { refetchInterval?: number } = {},
) {
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

type SuccessNotice<TResult, TVariables> =
  NoticeInput | ((result: TResult, variables: TVariables) => NoticeInput);

/**
 * Mutation that announces the outcome, reports errors consistently and refreshes the
 * affected queries.
 *
 * - `success`: a short past-tense title ("Nominees saved") or `{ title, description }`,
 *   optionally computed from the result ("Request RQ/26/000017 approved"). Shown as a
 *   top-right notification.
 * - Errors are left to the caller to show in context with `ErrorAlert`; `errorNotice`
 *   shows them as a notification instead, for background actions without a form on
 *   screen (row actions, confirm dialogs).
 * - `invalidate` lists path prefixes whose cached data is now stale.
 */
export function useApiMutation<TVariables, TResult = unknown>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  options: {
    success?: SuccessNotice<TResult, TVariables>;
    errorNotice?: boolean | string;
    invalidate?: string[];
  } & Omit<UseMutationOptions<TResult, ApiError, TVariables>, 'mutationFn'> = {},
) {
  const notify = useNotify();
  const queryClient = useQueryClient();
  const { success, errorNotice, invalidate, onSuccess, onError, ...rest } = options;
  return useMutation<TResult, ApiError, TVariables>({
    mutationFn,
    ...rest,
    onError: (error, variables, result, context) => {
      if (errorNotice) {
        notify.error({
          title: typeof errorNotice === 'string' ? errorNotice : 'Action not completed',
          description: error.message,
        });
      }
      return onError?.(error, variables, result, context);
    },
    onSuccess: async (data, variables, result, context) => {
      if (success) {
        notify.success(typeof success === 'function' ? success(data, variables) : success);
      }
      if (invalidate) {
        await Promise.all(
          invalidate.map((prefix) =>
            queryClient.invalidateQueries({
              predicate: (query) =>
                typeof query.queryKey[0] === 'string' &&
                (query.queryKey[0] as string).startsWith(prefix),
            }),
          ),
        );
      }
      await onSuccess?.(data, variables, result, context);
    },
  });
}
