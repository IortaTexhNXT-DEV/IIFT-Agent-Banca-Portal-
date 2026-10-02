import { Permission, type PermissionCode } from '../../src/common/security/permissions.js';

export interface RoleSeed {
  code: string;
  name: string;
  description: string;
  audience: 'PORTAL' | 'BACKOFFICE';
  permissions: PermissionCode[];
}

const P = Permission;

const PORTAL_BASE: PermissionCode[] = [
  P.PortalDashboard,
  P.PortalProfileView,
  P.PortalProfileUpdate,
  P.PortalHierarchyView,
  P.PortalParticipantsView,
  P.PortalParticipantsManage,
  P.PortalPoliciesView,
  P.PortalPoliciesQuote,
  P.PortalPoliciesSubmit,
  P.PortalPoliciesService,
  P.PortalBillingView,
  P.PortalBillingSubmit,
  P.PortalClaimsView,
  P.PortalClaimsSubmit,
  P.PortalIssues,
  P.PortalReports,
  P.PortalCommissionView,
];

const BO_READ: PermissionCode[] = [
  P.BoDashboard,
  P.BoAgenciesView,
  P.BoAgentsView,
  P.BoParticipantsView,
  P.BoPoliciesView,
  P.BoPaymentsView,
  P.BoReportsView,
];

/** Default roles; administrators can change permissions or add roles in the Back-office. */
export const ROLES: RoleSeed[] = [
  {
    code: 'AGENCY_PRINCIPAL',
    name: 'Agency principal / main agent',
    audience: 'PORTAL',
    description: 'Main agent: own business, sub-agents and agency-wide view; registers sub-agents',
    permissions: [...PORTAL_BASE, P.PortalAgencyWideView, P.PortalAgentRegister],
  },
  {
    code: 'AGENT',
    name: 'Agent',
    audience: 'PORTAL',
    description: 'Sub-agent: own quotations, policies, payments and claims',
    permissions: PORTAL_BASE,
  },
  {
    code: 'BANCA_OFFICER',
    name: 'Bank officer (banca)',
    audience: 'PORTAL',
    description: 'Bank officer selling financing takaful at the branch',
    permissions: PORTAL_BASE,
  },
  {
    code: 'BANCA_SUPERVISOR',
    name: 'Bank supervisor (banca)',
    audience: 'PORTAL',
    description: 'Bank branch supervisor: bank-wide view and officer registration',
    permissions: [...PORTAL_BASE, P.PortalAgencyWideView, P.PortalAgentRegister],
  },

  {
    code: 'SYSTEM_ADMINISTRATOR',
    name: 'System administrator',
    audience: 'BACKOFFICE',
    description: 'Users, roles, parameters, master data, workflows, products and integration',
    permissions: [
      P.BoDashboard,
      P.BoUsersManage,
      P.BoRolesManage,
      P.BoConfigManage,
      P.BoWorkflowConfigure,
      P.BoProductsManage,
      P.BoIntegrationManage,
      P.BoAuditView,
      P.BoAgenciesView,
      P.BoAgenciesManage,
      P.BoReportsView,
      P.BoReportsSchedule,
    ],
  },
  {
    code: 'OPERATIONS_OFFICER',
    name: 'Operations officer (maker)',
    audience: 'BACKOFFICE',
    description: 'Agent and agency administration, document checks, claims and issues',
    permissions: [
      ...BO_READ,
      P.BoAgenciesManage,
      P.BoAgentsManage,
      P.BoDocumentsVerify,
      P.BoClaimsManage,
      P.BoIssuesManage,
    ],
  },
  {
    code: 'OPERATIONS_SUPERVISOR',
    name: 'Operations supervisor (checker)',
    audience: 'BACKOFFICE',
    description: 'Approves agent, participant and servicing requests',
    permissions: [
      ...BO_READ,
      P.BoApproveAgents,
      P.BoApproveParticipants,
      P.BoApproveServicing,
      P.BoDocumentsVerify,
    ],
  },
  {
    code: 'UNDERWRITER',
    name: 'Underwriter / quality check',
    audience: 'BACKOFFICE',
    description: 'Approves referred quotations and performs quality checks before issuance',
    permissions: [...BO_READ, P.BoApprovePolicies, P.BoDocumentsVerify],
  },
  {
    code: 'FINANCE_OFFICER',
    name: 'Finance officer',
    audience: 'BACKOFFICE',
    description: 'Verifies payments, issues receipts, runs end-of-day and reconciliation',
    permissions: [
      ...BO_READ,
      P.BoApprovePayments,
      P.BoEodRun,
      P.BoIntegrationManage,
      P.BoReportsSchedule,
    ],
  },
  {
    code: 'COMPLIANCE_OFFICER',
    name: 'Compliance officer',
    audience: 'BACKOFFICE',
    description: 'Reviews AML/KYC cases and maintains watch-lists',
    permissions: [...BO_READ, P.BoAmlReview, P.BoAuditView],
  },
  {
    code: 'MANAGEMENT',
    name: 'Management',
    audience: 'BACKOFFICE',
    description: 'Management dashboard, KPIs and reports (read-only)',
    permissions: [...BO_READ, P.BoManagementDashboard, P.BoReportsSchedule],
  },
  {
    code: 'SUPPORT_DESK',
    name: 'Support desk',
    audience: 'BACKOFFICE',
    description: 'Handles issues reported through the portal',
    permissions: [P.BoDashboard, P.BoIssuesManage, P.BoAgentsView, P.BoAgenciesView],
  },
  {
    code: 'AUDITOR',
    name: 'Internal auditor',
    audience: 'BACKOFFICE',
    description: 'Read-only access to records and the audit trail',
    permissions: [...BO_READ, P.BoAuditView],
  },
];
