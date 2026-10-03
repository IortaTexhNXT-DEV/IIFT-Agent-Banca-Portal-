import { Flex } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import type { AgentView } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/format';
import { FieldGrid, type FieldItem } from '../FieldGrid';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { AGENT_TYPE_LABELS, idTypeLabel } from './agents';

export type AgentProfileField =
  | 'code'
  | 'type'
  | 'status'
  | 'agency'
  | 'parent'
  | 'branch'
  | 'id'
  | 'dob'
  | 'email'
  | 'mobile'
  | 'address'
  | 'licence'
  | 'licenceExpiry'
  | 'aml'
  | 'limit'
  | 'registered'
  | 'activated';

interface Props {
  agent: AgentView;
  /** Link to the reporting-line agent, when the viewer can open it. */
  parentLink?: (parent: NonNullable<AgentView['parent']>) => ReactNode;
  /** Standard fields to leave out, e.g. when a side card already shows them. */
  omit?: AgentProfileField[];
  columns?: 2 | 3 | 4;
}

export function LicenceExpiry({ value }: { value: string | null }) {
  if (!value) return <>–</>;
  const expired = dayjs(value).isBefore(dayjs(), 'day');
  return (
    <Flex gap={6} align="center">
      {formatDate(value)}
      {expired && <StatusTag status="EXPIRED" />}
    </Flex>
  );
}

/** AP-05/10, BO-05: registered profile, contact, agency and licensing details of an agent. */
export function AgentProfile({ agent, parentLink, omit = [], columns = 3 }: Props) {
  const fields: (FieldItem & { key: AgentProfileField })[] = [
    { key: 'code', label: 'Agent code', value: agent.agentCode },
    { key: 'type', label: 'Type', value: AGENT_TYPE_LABELS[agent.agentType] },
    {
      key: 'status',
      label: 'Status',
      value: (
        <Flex gap={8} align="center" wrap>
          <StatusTag status={agent.status} />
          {agent.statusReason && <span className="muted">{agent.statusReason}</span>}
        </Flex>
      ),
    },
    {
      key: 'agency',
      label: agent.agency.channel === 'BANCA' ? 'Bank' : 'Agency',
      value: `${agent.agency.name} (${agent.agency.code})`,
    },
    {
      key: 'parent',
      label: 'Reports to',
      value: agent.parent
        ? (parentLink?.(agent.parent) ?? `${agent.parent.fullName} (${agent.parent.agentCode})`)
        : null,
    },
    { key: 'branch', label: 'Branch', value: agent.branchName },
    { key: 'id', label: idTypeLabel(agent.idType), value: agent.idNumberMasked },
    { key: 'dob', label: 'Date of birth', value: formatDate(agent.dateOfBirth) },
    { key: 'email', label: 'E-mail', value: agent.email },
    { key: 'mobile', label: 'Mobile', value: agent.mobile },
    { key: 'address', label: 'Address', value: agent.address, span: 2 },
    { key: 'licence', label: 'Licence no.', value: agent.licenceNo },
    {
      key: 'licenceExpiry',
      label: 'Licence expiry',
      value: <LicenceExpiry value={agent.licenceExpiry} />,
    },
    { key: 'aml', label: 'AML status', value: <StatusTag status={agent.amlStatus} /> },
    {
      key: 'limit',
      label: 'Authority limit',
      value: agent.authorityLimit === null ? 'No limit' : <Money value={agent.authorityLimit} />,
    },
    { key: 'registered', label: 'Registered', value: formatDateTime(agent.createdAt) },
    { key: 'activated', label: 'Activated', value: formatDateTime(agent.activatedAt) },
  ];
  const items: FieldItem[] = fields.filter((field) => !omit.includes(field.key));
  return <FieldGrid columns={columns} items={items} />;
}
