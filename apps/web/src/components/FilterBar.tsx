/**
 * FilterBar – list filters (search, selects, date range) shown above a table.
 * Placed directly before a `.content-card` it joins that card as its toolbar; inside a
 * card prefer <TableCard toolbar={…}>, which does the same without a separate card.
 */
import { Card } from 'antd';
import type { ReactNode } from 'react';

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card className="filter-bar">
      <div className="table-toolbar__filters">{children}</div>
    </Card>
  );
}
