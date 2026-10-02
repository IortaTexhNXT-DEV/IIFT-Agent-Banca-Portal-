/**
 * TableCard – a card holding one table, with an optional toolbar row (filters left,
 * actions right) and an optional title. The table runs edge to edge and its pagination
 * sits bottom-right inside the card.
 *
 *   <TableCard toolbar={<PolicyFilters … />} actions={<Button>Export</Button>}>
 *     <DataTable … />
 *   </TableCard>
 */
import { Card } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  /** Shown in the card head, right of the title. */
  extra?: ReactNode;
  toolbar?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function TableToolbar({ filters, actions }: { filters?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="table-toolbar">
      <div className="table-toolbar__filters">{filters}</div>
      {actions && <div className="table-toolbar__actions">{actions}</div>}
    </div>
  );
}

export function TableCard({ title, extra, toolbar, actions, children }: Props) {
  return (
    <Card title={title} extra={extra} className="content-card content-card--flush">
      {(toolbar || actions) && <TableToolbar filters={toolbar} actions={actions} />}
      {children}
    </Card>
  );
}
