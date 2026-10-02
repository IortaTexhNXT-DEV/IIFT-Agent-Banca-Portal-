import { Table } from 'antd';
import { Link } from 'react-router';
import type { HierarchyNode } from '../../api/types';
import { StatusTag } from '../StatusTag';
import { AGENT_TYPE_LABELS } from './agents';

type Row = Omit<HierarchyNode, 'children'> & { children?: Row[] };

/** Leaf rows get no `children` so the table does not show an expand control for them. */
function toRows(nodes: HierarchyNode[]): Row[] {
  return nodes.map(({ children, ...node }) => ({ ...node, children: children.length > 0 ? toRows(children) : undefined }));
}

/** AP-09: main agent / sub-agent / bank officer reporting lines as an expandable tree. */
export function HierarchyTable({ nodes, memberPath }: { nodes: HierarchyNode[]; memberPath: (id: string) => string }) {
  return (
    <Table<Row>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={toRows(nodes)}
      expandable={{ defaultExpandAllRows: true }}
      scroll={{ x: 'max-content' }}
      locale={{ emptyText: 'No agents in your hierarchy' }}
      columns={[
        { title: 'Agent code', dataIndex: 'agentCode', width: 200, render: (code: string, row) => <Link to={memberPath(row.id)}>{code}</Link> },
        { title: 'Name', dataIndex: 'fullName' },
        { title: 'Type', dataIndex: 'agentType', width: 140, render: (type: Row['agentType']) => AGENT_TYPE_LABELS[type] },
        { title: 'Status', dataIndex: 'status', width: 120, render: (status: string) => <StatusTag status={status} /> },
        { title: 'Branch', dataIndex: 'branchName', width: 180, render: (branch: string | null) => branch ?? '–' },
      ]}
    />
  );
}
