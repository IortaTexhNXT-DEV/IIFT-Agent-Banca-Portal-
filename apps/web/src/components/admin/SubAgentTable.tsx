import { Table } from 'antd';
import { Link } from 'react-router';
import type { AgentDetail } from '../../api/types';
import { StatusTag } from '../StatusTag';
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
  return (
    <Table<SubAgent>
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={agents}
      locale={{ emptyText: 'No agents report to this agent' }}
      columns={[
        {
          title: 'Agent code',
          dataIndex: 'agentCode',
          render: (code: string, agent) => <Link to={memberPath(agent.id)}>{code}</Link>,
        },
        { title: 'Name', dataIndex: 'fullName' },
        {
          title: 'Type',
          dataIndex: 'agentType',
          render: (type: SubAgent['agentType']) => AGENT_TYPE_LABELS[type],
        },
        {
          title: 'Status',
          dataIndex: 'status',
          render: (status: string) => <StatusTag status={status} />,
        },
      ]}
    />
  );
}
