import type { AgentStatus, AgentType, Channel } from '../../api/types';
import type { ManagedAgentStatus } from '../../api/admin-types';

export const ID_TYPE_OPTIONS = [
  { value: 'NRIC', label: 'Brunei IC (NRIC)' },
  { value: 'PASSPORT', label: 'Passport' },
] as const;

export function idTypeLabel(idType: string): string {
  return idType === 'NRIC' ? 'IC number' : idType === 'PASSPORT' ? 'Passport number' : 'ID number';
}

export const AGENT_STATUSES: AgentStatus[] = [
  'PENDING',
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'TERMINATED',
  'REJECTED',
];

export const AGENT_TYPE_LABELS: Record<AgentType, string> = {
  MAIN_AGENT: 'Main agent',
  SUB_AGENT: 'Sub-agent',
  BANKER: 'Bank officer',
};

/** Agent types an agency (main agent, sub-agent) or bank (bank officer) can register. */
export const AGENT_TYPES_BY_CHANNEL: Record<Channel, AgentType[]> = {
  AGENCY: ['MAIN_AGENT', 'SUB_AGENT'],
  BANCA: ['BANKER'],
};

/** Agent type a reporting-line parent must have, or null when no parent is allowed. */
export const PARENT_TYPE: Record<AgentType, AgentType | null> = {
  MAIN_AGENT: null,
  SUB_AGENT: 'MAIN_AGENT',
  BANKER: 'BANKER',
};

/** Status changes allowed from each status (BO-07); mirrors the API rule. */
export const STATUS_TRANSITIONS: Record<AgentStatus, ManagedAgentStatus[]> = {
  PENDING: [],
  ACTIVE: ['INACTIVE', 'SUSPENDED', 'TERMINATED'],
  INACTIVE: ['ACTIVE', 'TERMINATED'],
  SUSPENDED: ['ACTIVE', 'TERMINATED'],
  TERMINATED: [],
  REJECTED: [],
};

export const CHANNEL_LABELS: Record<Channel, string> = { AGENCY: 'Agency', BANCA: 'Bancassurance' };
