import { Alert, Flex, Tag } from 'antd';
import type { Agency } from '../../api/types';
import { formatDateTime, formatNumber, humanise } from '../../utils/format';
import { FieldGrid, type FieldItem } from '../FieldGrid';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { CHANNEL_LABELS } from './agents';

/** "Permitted" or "Blocked" chip for the agency's new-business position (AP-42). */
export function IssuanceTag({ blocked }: { blocked: boolean }) {
  return blocked ? (
    <StatusTag status="SUSPENDED" label="Blocked" />
  ) : (
    <StatusTag status="ACTIVE" label="Permitted" />
  );
}

/** Payment block that stops new business for every agent of the agency (AP-42). */
export function IssuanceBlockAlert({ agency }: { agency: Agency }) {
  if (!agency.issuanceBlocked) return null;
  return (
    <Alert
      className="mb-16"
      type="error"
      showIcon
      title={`New business blocked since ${formatDateTime(agency.issuanceBlockedAt)} – overdue contributions`}
      description={agency.issuanceBlockReason}
    />
  );
}

/** Agent counts by status, as compact chips. */
function AgentCounts({ agency }: { agency: Agency }) {
  const byStatus = Object.entries(agency.agentsByStatus ?? {});
  if (byStatus.length === 0) return <>–</>;
  return (
    <Flex gap={4} wrap>
      {byStatus.map(([status, count]) => (
        <Tag key={status} variant="filled">
          {humanise(status)} {count}
        </Tag>
      ))}
    </Flex>
  );
}

function detailItems(agency: Agency): FieldItem[] {
  return [
    { key: 'name', label: 'Name', value: agency.name },
    { key: 'code', label: 'Code', value: agency.code },
    { key: 'channel', label: 'Channel', value: CHANNEL_LABELS[agency.channel] },
    { key: 'status', label: 'Status', value: <StatusTag status={agency.status} /> },
    { key: 'registration', label: 'Registration no.', value: agency.registrationNo },
    {
      key: 'issuance',
      label: 'New business',
      value: <IssuanceTag blocked={agency.issuanceBlocked} />,
    },
    { key: 'email', label: 'E-mail', value: agency.email },
    { key: 'phone', label: 'Phone', value: agency.phone },
    { key: 'address', label: 'Address', value: agency.address, span: 'full' },
  ];
}

function activityItems(agency: Agency): FieldItem[] {
  return [
    { key: 'agents', label: 'Agents', value: <AgentCounts agency={agency} />, span: 'full' },
    {
      key: 'outstandingPolicies',
      label: 'Policies awaiting payment',
      value: formatNumber(agency.outstandingPolicies ?? 0),
    },
    {
      key: 'outstandingAmount',
      label: 'Outstanding contribution',
      value: <Money value={agency.outstandingAmount ?? 0} strong />,
    },
  ];
}

interface Props {
  agency: Agency;
  /** Which fields to show: the contact details, the agent and contribution figures, or both. */
  fields?: 'all' | 'details' | 'activity';
  columns?: 2 | 3 | 4;
}

/** AP-10, BO-09: agency or bank details, agents by status and outstanding contributions. */
export function AgencySummary({ agency, fields = 'all', columns = 3 }: Props) {
  const items =
    fields === 'details'
      ? detailItems(agency)
      : fields === 'activity'
        ? activityItems(agency)
        : [...detailItems(agency), ...activityItems(agency)];
  return <FieldGrid columns={columns} items={items} />;
}
