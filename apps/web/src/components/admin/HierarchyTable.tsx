import { Link, useNavigate } from 'react-router';
import type { HierarchyNode } from '../../api/types';
import { DataTable, statusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { AGENT_TYPE_LABELS } from './agents';

type Row = Omit<HierarchyNode, 'children'> & { children?: Row[] };

/** Leaf rows get no `children` so the table does not show an expand control for them. */
function toRows(nodes: HierarchyNode[]): Row[] {
  return nodes.map(({ children, ...node }) => ({
    ...node,
    children: children.length > 0 ? toRows(children) : undefined,
  }));
}

/** AP-09: main agent / sub-agent / bank officer reporting lines as an expandable tree. */
export function HierarchyTable({
  nodes,
  memberPath,
}: {
  nodes: HierarchyNode[];
  memberPath: (id: string) => string;
}) {
  const navigate = useNavigate();
  return (
    <DataTable<Row>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={toRows(nodes)}
      expandable={{ defaultExpandAllRows: true }}
      scroll={{}}
      onRowClick={(row) => navigate(memberPath(row.id))}
      locale={{ emptyText: <EmptyState label="No agents in the hierarchy" /> }}
      columns={[
        {
          title: 'Agent code',
          dataIndex: 'agentCode',
          width: 170,
          render: (code: string, row) => <Link to={memberPath(row.id)}>{code}</Link>,
        },
        textColumn('Name', 'fullName'),
        {
          title: 'Type',
          dataIndex: 'agentType',
          width: 120,
          render: (type: Row['agentType']) => AGENT_TYPE_LABELS[type],
        },
        statusColumn('Status', 'status', 110),
        textColumn('Branch', 'branchName', 160),
      ]}
    />
  );
}
