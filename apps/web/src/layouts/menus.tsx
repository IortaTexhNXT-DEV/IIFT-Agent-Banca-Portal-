import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  CheckSquareOutlined,
  ClusterOutlined,
  ControlOutlined,
  CustomerServiceOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FundOutlined,
  MedicineBoxOutlined,
  PlusCircleOutlined,
  ReconciliationOutlined,
  SafetyCertificateOutlined,
  ScheduleOutlined,
  SettingOutlined,
  SolutionOutlined,
  SyncOutlined,
  TeamOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { APPROVE_PERMISSIONS, P } from '../utils/permissions';

export interface MenuEntry {
  path: string;
  label: string;
  icon: ReactNode;
  /** Visible when the user holds any of these permissions (none = always). */
  anyOf?: string[];
  /** Highlighted only on this exact path, not on the pages below it (module dashboards). */
  exact?: boolean;
}

export interface MenuGroup {
  label?: string;
  entries: MenuEntry[];
}

export const PORTAL_MENU: MenuGroup[] = [
  {
    entries: [
      {
        path: '/portal',
        label: 'Dashboard',
        icon: <DashboardOutlined />,
        anyOf: [P.portalDashboard],
        exact: true,
      },
      {
        path: '/portal/quotations/new',
        label: 'New quotation',
        icon: <PlusCircleOutlined />,
        anyOf: [P.portalPoliciesQuote],
      },
    ],
  },
  {
    label: 'Business',
    entries: [
      {
        path: '/portal/policies',
        label: 'Quotations & policies',
        icon: <FileProtectOutlined />,
        anyOf: [P.portalPoliciesView],
      },
      {
        path: '/portal/renewals',
        label: 'Renewals',
        icon: <SyncOutlined />,
        anyOf: [P.portalPoliciesView],
      },
      {
        path: '/portal/participants',
        label: 'Participants',
        icon: <TeamOutlined />,
        anyOf: [P.portalParticipantsView],
      },
      {
        path: '/portal/billing',
        label: 'Billing & payments',
        icon: <WalletOutlined />,
        anyOf: [P.portalBillingView],
      },
      {
        path: '/portal/claims',
        label: 'Claims',
        icon: <MedicineBoxOutlined />,
        anyOf: [P.portalClaimsView],
      },
      { path: '/portal/requests', label: 'My requests', icon: <CheckSquareOutlined /> },
    ],
  },
  {
    label: 'Agency',
    entries: [
      {
        path: '/portal/team',
        label: 'Team & hierarchy',
        icon: <ApartmentOutlined />,
        anyOf: [P.portalHierarchyView],
      },
      {
        path: '/portal/commission',
        label: 'Commission',
        icon: <DollarOutlined />,
        anyOf: [P.portalCommissionView],
      },
      {
        path: '/portal/reports',
        label: 'Reports',
        icon: <BarChartOutlined />,
        anyOf: [P.portalReports],
      },
      {
        path: '/portal/issues',
        label: 'Support',
        icon: <CustomerServiceOutlined />,
        anyOf: [P.portalIssues],
      },
    ],
  },
];

export const BACKOFFICE_MENU: MenuGroup[] = [
  {
    entries: [
      {
        path: '/backoffice',
        label: 'Dashboard',
        icon: <DashboardOutlined />,
        anyOf: [P.boDashboard],
        exact: true,
      },
      {
        path: '/backoffice/approvals',
        label: 'Approvals',
        icon: <CheckSquareOutlined />,
        anyOf: APPROVE_PERMISSIONS,
      },
    ],
  },
  {
    label: 'Distribution',
    entries: [
      {
        path: '/backoffice/agents',
        label: 'Agents & bankers',
        icon: <UserOutlined />,
        anyOf: [P.boAgentsView],
      },
      {
        path: '/backoffice/agencies',
        label: 'Agencies & banks',
        icon: <BankOutlined />,
        anyOf: [P.boAgenciesView],
      },
    ],
  },
  {
    label: 'Business',
    entries: [
      {
        path: '/backoffice/policies',
        label: 'Policies',
        icon: <FileProtectOutlined />,
        anyOf: [P.boPoliciesView],
      },
      {
        path: '/backoffice/participants',
        label: 'Participants',
        icon: <TeamOutlined />,
        anyOf: [P.boParticipantsView],
      },
      {
        path: '/backoffice/payments',
        label: 'Payments',
        icon: <WalletOutlined />,
        anyOf: [P.boPaymentsView],
      },
      {
        path: '/backoffice/claims',
        label: 'Claims',
        icon: <MedicineBoxOutlined />,
        anyOf: [P.boClaimsManage],
      },
    ],
  },
  {
    label: 'Control',
    entries: [
      {
        path: '/backoffice/aml',
        label: 'AML / KYC',
        icon: <SafetyCertificateOutlined />,
        anyOf: [P.boAmlReview],
      },
      {
        path: '/backoffice/documents',
        label: 'Document checks',
        icon: <FileSearchOutlined />,
        anyOf: [P.boDocumentsVerify],
      },
      {
        path: '/backoffice/audit',
        label: 'Audit trail',
        icon: <AuditOutlined />,
        anyOf: [P.boAuditView],
      },
    ],
  },
  {
    label: 'Operations',
    entries: [
      {
        path: '/backoffice/issues',
        label: 'Issues',
        icon: <AlertOutlined />,
        anyOf: [P.boIssuesManage],
      },
      {
        path: '/backoffice/reports',
        label: 'Reports',
        icon: <FundOutlined />,
        anyOf: [P.boReportsView],
      },
      {
        path: '/backoffice/eod',
        label: 'End of day',
        icon: <ScheduleOutlined />,
        anyOf: [P.boEodRun],
      },
      {
        path: '/backoffice/integration',
        label: 'Integration',
        icon: <ReconciliationOutlined />,
        anyOf: [P.boIntegrationManage],
      },
    ],
  },
  {
    label: 'Administration',
    entries: [
      {
        path: '/backoffice/users',
        label: 'Users',
        icon: <SolutionOutlined />,
        anyOf: [P.boUsersManage],
      },
      {
        path: '/backoffice/roles',
        label: 'Roles & permissions',
        icon: <ClusterOutlined />,
        anyOf: [P.boRolesManage],
      },
      {
        path: '/backoffice/workflows',
        label: 'Workflows',
        icon: <ControlOutlined />,
        anyOf: [P.boWorkflowConfigure],
      },
      {
        path: '/backoffice/products',
        label: 'Products',
        icon: <FileTextOutlined />,
        anyOf: [P.boProductsManage],
      },
      {
        path: '/backoffice/settings',
        label: 'Parameters & master data',
        icon: <SettingOutlined />,
        anyOf: [P.boConfigManage],
      },
    ],
  },
];

/**
 * Menu key to highlight for a path: the longest entry path that equals the path or is a
 * parent of it. Exact entries match only their own path, and pages outside the menu
 * highlight nothing.
 */
export function selectedMenuKeys(menu: MenuGroup[], pathname: string): string[] {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const match = menu
    .flatMap((group) => group.entries)
    .filter((entry) => path === entry.path || (!entry.exact && path.startsWith(`${entry.path}/`)))
    .map((entry) => entry.path)
    .sort((a, b) => b.length - a.length)[0];
  return match ? [match] : [];
}
