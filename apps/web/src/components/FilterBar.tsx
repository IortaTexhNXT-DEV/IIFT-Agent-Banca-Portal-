import { Card, Flex } from 'antd';
import type { ReactNode } from 'react';

/** Compact row of list filters placed above a table. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Card size="small" className="filter-bar">
      <Flex gap={12} wrap align="center">
        {children}
      </Flex>
    </Card>
  );
}
