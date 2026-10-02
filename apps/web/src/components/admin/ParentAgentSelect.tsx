import { Select, type SelectProps } from 'antd';
import { useApiQuery } from '../../api/hooks';
import type { AgentType, AgentView, Page } from '../../api/types';
import { PARENT_TYPE } from './agents';

interface Props extends Omit<SelectProps<string>, 'options' | 'loading' | 'showSearch'> {
  agencyId?: string;
  agentType?: AgentType;
  /** The agent being edited, who cannot report to themselves. */
  excludeId?: string;
}

/** BO-08: active main agents (for sub-agents) or bank officers (for bank officers) of one agency. */
export function ParentAgentSelect({ agencyId, agentType, excludeId, ...props }: Props) {
  const parentType = agentType ? PARENT_TYPE[agentType] : null;
  const candidates = useApiQuery<Page<AgentView>>(
    agencyId && parentType ? '/backoffice/agents' : null,
    { agencyId, agentType: parentType, status: 'ACTIVE', pageSize: 100 },
  );
  return (
    <Select<string>
      {...props}
      showSearch={{ optionFilterProp: 'label' }}
      loading={candidates.isLoading}
      options={(candidates.data?.items ?? [])
        .filter((agent) => agent.id !== excludeId)
        .map((agent) => ({ value: agent.id, label: `${agent.fullName} (${agent.agentCode})` }))}
    />
  );
}
