import { Link, useNavigate } from 'react-router';
import type { AgentDetail } from '../../api/types';
import { DataTable, statusColumn, textColumn } from '../DataTable';
import { EmptyState } from '../EmptyState';
import { AGENT_TYPE_LABELS } from './agents';

type SubAgent = AgentDetail['subAgents'][number];

/** BO-08 / AP-09: agents and bank officers who report directly to an agent. */
export function SubAgentTable({
  agents,
  memberPath,
}: {
  agents: SubAgent[];
  memberPath: (id: string) => string;
}) {
  const navigate = useNavigate();
  return (
    <DataTable<SubAgent>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={agents}
      scroll={{}}
      onRowClick={(agent) => navigate(memberPath(agent.id))}
      locale={{ emptyText: <EmptyState label="No reporting agents" /> }}
      columns={[
        {
          title: 'Agent code',
          dataIndex: 'agentCode',
          width: 130,
          render: (code: string, agent) => <Link to={memberPath(agent.id)}>{code}</Link>,
        },
        textColumn('Name', 'fullName'),
        {
          title: 'Type',
          dataIndex: 'agentType',
          width: 120,
          render: (type: SubAgent['agentType']) => AGENT_TYPE_LABELS[type],
        },
        statusColumn('Status', 'status', 110),
      ]}
    />
  );
}
