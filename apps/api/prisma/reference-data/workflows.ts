import { Permission } from '../../src/common/security/permissions.js';
import type { ApprovalType } from '../../src/generated/prisma/enums.js';

export interface WorkflowSeed {
  type: ApprovalType;
  name: string;
  description: string;
  steps: { name: string; permission: string; minAmount?: number }[];
}

/** Default approval workflows (COM-04). Thresholds and levels are configurable in the Back-office. */
export const WORKFLOWS: WorkflowSeed[] = [
  {
    type: 'AGENT_REGISTRATION',
    name: 'Agent / banker registration',
    description: 'New agents and bank officers',
    steps: [{ name: 'Operations supervisor approval', permission: Permission.BoApproveAgents }],
  },
  {
    type: 'AGENT_PROFILE_UPDATE',
    name: 'Agent profile update',
    description: 'Changes to agent details and reporting line',
    steps: [{ name: 'Operations supervisor approval', permission: Permission.BoApproveAgents }],
  },
  {
    type: 'AGENT_STATUS_CHANGE',
    name: 'Agent status change',
    description: 'Activation, suspension, deactivation and termination',
    steps: [{ name: 'Operations supervisor approval', permission: Permission.BoApproveAgents }],
  },
  {
    type: 'PARTICIPANT_UPDATE',
    name: 'Participant update',
    description: 'Changes to participant details',
    steps: [
      { name: 'Operations supervisor approval', permission: Permission.BoApproveParticipants },
    ],
  },
  {
    type: 'POLICY_REFERRAL',
    name: 'Referred quotation',
    description: 'High-risk limit, authority limit, declarations or quality check',
    steps: [
      { name: 'Underwriting / quality check', permission: Permission.BoApprovePolicies },
      {
        name: 'Second approval (sum covered from B$300,000)',
        permission: Permission.BoApprovePolicies,
        minAmount: 300_000,
      },
    ],
  },
  {
    type: 'POLICY_ENDORSEMENT',
    name: 'Policy endorsement',
    description: 'Non-financial endorsements',
    steps: [{ name: 'Policy servicing approval', permission: Permission.BoApproveServicing }],
  },
  {
    type: 'POLICY_CANCELLATION',
    name: 'Policy cancellation',
    description: 'Cancellation with pro-rata refund',
    steps: [{ name: 'Policy servicing approval', permission: Permission.BoApproveServicing }],
  },
  {
    type: 'PAYMENT_VERIFICATION',
    name: 'Payment verification',
    description: 'Verification of payment proof and receipt issuance',
    steps: [{ name: 'Finance verification', permission: Permission.BoApprovePayments }],
  },
];
