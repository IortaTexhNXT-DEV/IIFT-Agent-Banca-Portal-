import { Skeleton } from 'antd';
import type { ReactNode } from 'react';
import { ErrorAlert } from './ErrorAlert';

interface Props<T> {
  query: { data: T | undefined; isLoading: boolean; error: unknown };
  children: (data: T) => ReactNode;
  rows?: number;
}

/** Renders loading and error states so pages only deal with loaded data. */
export function QueryState<T>({ query, children, rows = 6 }: Props<T>) {
  if (query.isLoading) return <Skeleton active paragraph={{ rows }} />;
  if (query.error) return <ErrorAlert error={query.error} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}
