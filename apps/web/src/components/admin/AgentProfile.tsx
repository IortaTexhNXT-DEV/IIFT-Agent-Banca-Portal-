import { Descriptions, type DescriptionsProps, Flex } from 'antd';
import dayjs from 'dayjs';
import type { ReactNode } from 'react';
import type { AgentView } from '../../api/types';
import { formatDate, formatDateTime } from '../../utils/format';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { AGENT_TYPE_LABELS, idTypeLabel } from './agents';

interface Props {
  agent: AgentView;
  /** Link to the reporting-line agent, when the viewer can open it. */
  parentLink?: (parent: NonNullable<AgentView['parent']>) => ReactNode;
  /** Extra rows appended after the standard profile fields. */
  extra?: DescriptionsProps['items'];
}

function LicenceExpiry({ value }: { value: string | null }) {
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
export function AgentProfile({ agent, parentLink, extra = [] }: Props) {
  const items: DescriptionsProps['items'] = [
    { key: 'code', label: 'Agent code', children: agent.agentCode },
    { key: 'type', label: 'Type', children: AGENT_TYPE_LABELS[agent.agentType] },
    {
      key: 'status',
      label: 'Status',
      children: (
        <Flex gap={8} align="center" wrap>
          <StatusTag status={agent.status} />
          {agent.statusReason && <span className="muted">{agent.statusReason}</span>}
        </Flex>
      ),
    },
    {
      key: 'agency',
      label: agent.agency.channel === 'BANCA' ? 'Bank' : 'Agency',
      children: `${agent.agency.name} (${agent.agency.code})`,
    },
    {
      key: 'parent',
      label: 'Reports to',
      children: agent.parent
        ? (parentLink?.(agent.parent) ?? `${agent.parent.fullName} (${agent.parent.agentCode})`)
        : '–',
    },
    { key: 'branch', label: 'Branch', children: agent.branchName ?? '–' },
    { key: 'id', label: idTypeLabel(agent.idType), children: agent.idNumberMasked },
    { key: 'dob', label: 'Date of birth', children: formatDate(agent.dateOfBirth) },
    { key: 'email', label: 'Email', children: agent.email },
    { key: 'mobile', label: 'Mobile', children: agent.mobile },
    { key: 'address', label: 'Address', children: agent.address ?? '–' },
    { key: 'licence', label: 'Licence no.', children: agent.licenceNo ?? '–' },
    {
      key: 'licenceExpiry',
      label: 'Licence expiry',
      children: <LicenceExpiry value={agent.licenceExpiry} />,
    },
    { key: 'aml', label: 'AML status', children: <StatusTag status={agent.amlStatus} /> },
    {
      key: 'limit',
      label: 'Authority limit',
      children: agent.authorityLimit === null ? 'No limit' : <Money value={agent.authorityLimit} />,
    },
    { key: 'registered', label: 'Registered', children: formatDateTime(agent.createdAt) },
    { key: 'activated', label: 'Activated', children: formatDateTime(agent.activatedAt) },
    ...extra,
  ];
  return <Descriptions size="small" column={{ xs: 1, md: 2, xl: 3 }} items={items} />;
}
