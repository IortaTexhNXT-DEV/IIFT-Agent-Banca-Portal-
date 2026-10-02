import { Alert, Descriptions, Flex, Tag } from 'antd';
import type { Agency } from '../../api/types';
import { formatDateTime, formatNumber, humanise } from '../../utils/format';
import { Money } from '../Money';
import { StatusTag } from '../StatusTag';
import { CHANNEL_LABELS } from './agents';

/** Payment block that stops new business for every agent of the agency (AP-42). */
export function IssuanceBlockAlert({ agency }: { agency: Agency }) {
  if (!agency.issuanceBlocked) return null;
  return (
    <Alert
      className="mb-16"
      type="error"
      showIcon
      title="New business is blocked for overdue contributions"
      description={`${agency.issuanceBlockReason ?? 'Contributions are overdue.'} Blocked since ${formatDateTime(agency.issuanceBlockedAt)}.`}
    />
  );
}

/** AP-10, BO-09: agency or bank details, agents by status and outstanding contributions. */
export function AgencySummary({ agency }: { agency: Agency }) {
  const byStatus = Object.entries(agency.agentsByStatus ?? {});
  return (
    <Descriptions
      size="small"
      column={{ xs: 1, md: 2, xl: 3 }}
      items={[
        { key: 'name', label: 'Name', children: agency.name },
        { key: 'code', label: 'Code', children: agency.code },
        { key: 'channel', label: 'Channel', children: CHANNEL_LABELS[agency.channel] },
        { key: 'status', label: 'Status', children: <StatusTag status={agency.status} /> },
        { key: 'registration', label: 'Registration no.', children: agency.registrationNo ?? '–' },
        {
          key: 'issuance',
          label: 'New business',
          children: agency.issuanceBlocked ? <StatusTag status="SUSPENDED" label="Blocked" /> : <StatusTag status="ACTIVE" label="Permitted" />,
        },
        { key: 'email', label: 'Email', children: agency.email ?? '–' },
        { key: 'phone', label: 'Phone', children: agency.phone ?? '–' },
        { key: 'address', label: 'Address', children: agency.address ?? '–' },
        {
          key: 'agents',
          label: 'Agents',
          children:
            byStatus.length === 0 ? (
              'None registered'
            ) : (
              <Flex gap={4} wrap>
                {byStatus.map(([status, count]) => (
                  <Tag key={status} variant="filled">
                    {humanise(status)}: {count}
                  </Tag>
                ))}
              </Flex>
            ),
        },
        { key: 'outstandingPolicies', label: 'Policies awaiting payment', children: formatNumber(agency.outstandingPolicies ?? 0) },
        { key: 'outstandingAmount', label: 'Outstanding contribution', children: <Money value={agency.outstandingAmount ?? 0} /> },
      ]}
    />
  );
}
