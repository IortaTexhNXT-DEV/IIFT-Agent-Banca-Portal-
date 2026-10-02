/**
 * Permission catalogue. Roles are configurable in the Back-office (BO-04), but the
 * permissions they are built from are defined here because each one guards code.
 * Portal permissions can only be granted to portal roles and vice versa.
 */
export const Permission = {
  // Agent/Banca Portal
  PortalDashboard: 'portal.dashboard',
  PortalProfileView: 'portal.profile.view',
  PortalProfileUpdate: 'portal.profile.update',
  PortalHierarchyView: 'portal.hierarchy.view',
  PortalAgentRegister: 'portal.agents.register',
  PortalAgencyWideView: 'portal.agency.view_all',
  PortalCrossAgencyView: 'portal.participants.cross_agency',
  PortalParticipantsView: 'portal.participants.view',
  PortalParticipantsManage: 'portal.participants.manage',
  PortalPoliciesView: 'portal.policies.view',
  PortalPoliciesQuote: 'portal.policies.quote',
  PortalPoliciesSubmit: 'portal.policies.submit',
  PortalPoliciesService: 'portal.policies.service',
  PortalBillingView: 'portal.billing.view',
  PortalBillingSubmit: 'portal.billing.submit',
  PortalClaimsView: 'portal.claims.view',
  PortalClaimsSubmit: 'portal.claims.submit',
  PortalIssues: 'portal.issues',
  PortalReports: 'portal.reports',
  PortalCommissionView: 'portal.commission.view',

  // Back-office
  BoDashboard: 'bo.dashboard',
  BoManagementDashboard: 'bo.dashboard.management',
  BoUsersManage: 'bo.users.manage',
  BoRolesManage: 'bo.roles.manage',
  BoAgenciesView: 'bo.agencies.view',
  BoAgenciesManage: 'bo.agencies.manage',
  BoAgentsView: 'bo.agents.view',
  BoAgentsManage: 'bo.agents.manage',
  BoParticipantsView: 'bo.participants.view',
  BoPoliciesView: 'bo.policies.view',
  BoPaymentsView: 'bo.payments.view',
  BoClaimsManage: 'bo.claims.manage',
  BoDocumentsVerify: 'bo.documents.verify',
  BoAmlReview: 'bo.aml.review',
  BoApproveAgents: 'bo.approve.agents',
  BoApproveParticipants: 'bo.approve.participants',
  BoApprovePolicies: 'bo.approve.policies',
  BoApproveServicing: 'bo.approve.servicing',
  BoApprovePayments: 'bo.approve.payments',
  BoWorkflowConfigure: 'bo.workflow.configure',
  BoProductsManage: 'bo.products.manage',
  BoIssuesManage: 'bo.issues.manage',
  BoReportsView: 'bo.reports.view',
  BoReportsSchedule: 'bo.reports.schedule',
  BoAuditView: 'bo.audit.view',
  BoConfigManage: 'bo.config.manage',
  BoIntegrationManage: 'bo.integration.manage',
  BoEodRun: 'bo.eod.run',
} as const;

export type PermissionCode = (typeof Permission)[keyof typeof Permission];

export interface PermissionDescriptor {
  code: PermissionCode;
  audience: 'PORTAL' | 'BACKOFFICE';
  group: string;
  description: string;
}

export const PERMISSION_CATALOGUE: PermissionDescriptor[] = [
  {
    code: Permission.PortalDashboard,
    audience: 'PORTAL',
    group: 'Dashboard',
    description: 'View agent/banca dashboard',
  },
  {
    code: Permission.PortalProfileView,
    audience: 'PORTAL',
    group: 'Profile',
    description: 'View own profile and agency information',
  },
  {
    code: Permission.PortalProfileUpdate,
    audience: 'PORTAL',
    group: 'Profile',
    description: 'Request profile updates',
  },
  {
    code: Permission.PortalHierarchyView,
    audience: 'PORTAL',
    group: 'Profile',
    description: 'View main/sub-agent hierarchy',
  },
  {
    code: Permission.PortalAgentRegister,
    audience: 'PORTAL',
    group: 'Agents',
    description: 'Register new sub-agents/bank officers',
  },
  {
    code: Permission.PortalAgencyWideView,
    audience: 'PORTAL',
    group: 'Visibility',
    description: 'View all records of own agency/bank',
  },
  {
    code: Permission.PortalCrossAgencyView,
    audience: 'PORTAL',
    group: 'Visibility',
    description: 'Consolidated participant view across agencies',
  },
  {
    code: Permission.PortalParticipantsView,
    audience: 'PORTAL',
    group: 'Participants',
    description: 'Search and view participants',
  },
  {
    code: Permission.PortalParticipantsManage,
    audience: 'PORTAL',
    group: 'Participants',
    description: 'Register participants and request updates',
  },
  {
    code: Permission.PortalPoliciesView,
    audience: 'PORTAL',
    group: 'Policies',
    description: 'View quotations and policies',
  },
  {
    code: Permission.PortalPoliciesQuote,
    audience: 'PORTAL',
    group: 'Policies',
    description: 'Create and save quotations',
  },
  {
    code: Permission.PortalPoliciesSubmit,
    audience: 'PORTAL',
    group: 'Policies',
    description: 'Submit quotations for issuance',
  },
  {
    code: Permission.PortalPoliciesService,
    audience: 'PORTAL',
    group: 'Policies',
    description: 'Renewal, endorsement and cancellation requests',
  },
  {
    code: Permission.PortalBillingView,
    audience: 'PORTAL',
    group: 'Billing',
    description: 'View outstanding contributions, payments and receipts',
  },
  {
    code: Permission.PortalBillingSubmit,
    audience: 'PORTAL',
    group: 'Billing',
    description: 'Submit payments and payment proof',
  },
  {
    code: Permission.PortalClaimsView,
    audience: 'PORTAL',
    group: 'Claims',
    description: 'View claim notifications',
  },
  {
    code: Permission.PortalClaimsSubmit,
    audience: 'PORTAL',
    group: 'Claims',
    description: 'Submit claim notifications',
  },
  {
    code: Permission.PortalIssues,
    audience: 'PORTAL',
    group: 'Support',
    description: 'Report and track issues',
  },
  {
    code: Permission.PortalReports,
    audience: 'PORTAL',
    group: 'Reports',
    description: 'Run agency/agent reports',
  },
  {
    code: Permission.PortalCommissionView,
    audience: 'PORTAL',
    group: 'Reports',
    description: 'View commission / referral fee',
  },

  {
    code: Permission.BoDashboard,
    audience: 'BACKOFFICE',
    group: 'Dashboard',
    description: 'View pending-action dashboard',
  },
  {
    code: Permission.BoManagementDashboard,
    audience: 'BACKOFFICE',
    group: 'Dashboard',
    description: 'View management KPIs and trends',
  },
  {
    code: Permission.BoUsersManage,
    audience: 'BACKOFFICE',
    group: 'Administration',
    description: 'Create, update and deactivate users',
  },
  {
    code: Permission.BoRolesManage,
    audience: 'BACKOFFICE',
    group: 'Administration',
    description: 'Maintain roles and permissions',
  },
  {
    code: Permission.BoAgenciesView,
    audience: 'BACKOFFICE',
    group: 'Agency',
    description: 'View agencies and banks',
  },
  {
    code: Permission.BoAgenciesManage,
    audience: 'BACKOFFICE',
    group: 'Agency',
    description: 'Maintain agencies and banks',
  },
  {
    code: Permission.BoAgentsView,
    audience: 'BACKOFFICE',
    group: 'Agents',
    description: 'Search and view agents/bank officers',
  },
  {
    code: Permission.BoAgentsManage,
    audience: 'BACKOFFICE',
    group: 'Agents',
    description: 'Register, update and change status of agents (maker)',
  },
  {
    code: Permission.BoParticipantsView,
    audience: 'BACKOFFICE',
    group: 'Participants',
    description: 'Search and view participants',
  },
  {
    code: Permission.BoPoliciesView,
    audience: 'BACKOFFICE',
    group: 'Policies',
    description: 'Search and view policies',
  },
  {
    code: Permission.BoPaymentsView,
    audience: 'BACKOFFICE',
    group: 'Billing',
    description: 'View payments and receipts',
  },
  {
    code: Permission.BoClaimsManage,
    audience: 'BACKOFFICE',
    group: 'Claims',
    description: 'Review and update claim notifications',
  },
  {
    code: Permission.BoDocumentsVerify,
    audience: 'BACKOFFICE',
    group: 'Documents',
    description: 'Verify or reject documents',
  },
  {
    code: Permission.BoAmlReview,
    audience: 'BACKOFFICE',
    group: 'Compliance',
    description: 'Review AML/KYC screening cases and watch-lists',
  },
  {
    code: Permission.BoApproveAgents,
    audience: 'BACKOFFICE',
    group: 'Approvals',
    description: 'Approve agent registration and changes (checker)',
  },
  {
    code: Permission.BoApproveParticipants,
    audience: 'BACKOFFICE',
    group: 'Approvals',
    description: 'Approve participant updates (checker)',
  },
  {
    code: Permission.BoApprovePolicies,
    audience: 'BACKOFFICE',
    group: 'Approvals',
    description: 'Approve referred policies / quality check',
  },
  {
    code: Permission.BoApproveServicing,
    audience: 'BACKOFFICE',
    group: 'Approvals',
    description: 'Approve endorsements and cancellations',
  },
  {
    code: Permission.BoApprovePayments,
    audience: 'BACKOFFICE',
    group: 'Approvals',
    description: 'Verify payments and issue receipts',
  },
  {
    code: Permission.BoWorkflowConfigure,
    audience: 'BACKOFFICE',
    group: 'Administration',
    description: 'Configure approval workflows',
  },
  {
    code: Permission.BoProductsManage,
    audience: 'BACKOFFICE',
    group: 'Administration',
    description: 'Maintain products and rating parameters',
  },
  {
    code: Permission.BoIssuesManage,
    audience: 'BACKOFFICE',
    group: 'Support',
    description: 'Assign, prioritise and resolve issues',
  },
  {
    code: Permission.BoReportsView,
    audience: 'BACKOFFICE',
    group: 'Reports',
    description: 'Run and export reports',
  },
  {
    code: Permission.BoReportsSchedule,
    audience: 'BACKOFFICE',
    group: 'Reports',
    description: 'Maintain scheduled reports',
  },
  {
    code: Permission.BoAuditView,
    audience: 'BACKOFFICE',
    group: 'Audit',
    description: 'Search audit trail',
  },
  {
    code: Permission.BoConfigManage,
    audience: 'BACKOFFICE',
    group: 'Administration',
    description: 'Maintain system parameters and master data',
  },
  {
    code: Permission.BoIntegrationManage,
    audience: 'BACKOFFICE',
    group: 'Integration',
    description: 'Monitor and retry integrations, reconciliation',
  },
  {
    code: Permission.BoEodRun,
    audience: 'BACKOFFICE',
    group: 'Operations',
    description: 'Run end-of-day processing',
  },
];

const KNOWN_CODES = new Set<string>(PERMISSION_CATALOGUE.map((p) => p.code));

export function isKnownPermission(code: string): code is PermissionCode {
  return KNOWN_CODES.has(code);
}

export function permissionAudience(code: PermissionCode): 'PORTAL' | 'BACKOFFICE' {
  return code.startsWith('portal.') ? 'PORTAL' : 'BACKOFFICE';
}
