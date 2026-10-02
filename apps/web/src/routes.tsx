import { Spin } from 'antd';
import { type ComponentType, lazy, type ReactNode, Suspense } from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router';
import { homePath, useAuth } from './auth/AuthContext';
import type { Audience } from './api/types';
import { AppShell } from './layouts/AppShell';
import { BACKOFFICE_MENU, PORTAL_MENU } from './layouts/menus';

/** Pages are loaded on demand so the first screen stays small. */
function page(load: () => Promise<{ default: ComponentType }>): ReactNode {
  const Component = lazy(load);
  return (
    <Suspense fallback={<Spin className="page-loading" />}>
      <Component />
    </Suspense>
  );
}

function RequireAudience({ audience, children }: { audience: Audience; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spin fullscreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (user.audience !== audience) return <Navigate to={homePath(user)} replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <Spin fullscreen />;
  return <Navigate to={user ? homePath(user) : '/login'} replace />;
}

/** Notification links to a maker's request are audience-neutral; the back-office shows them as approvals. */
function BackofficeRequestRedirect() {
  const { id } = useParams();
  return <Navigate to={`/backoffice/approvals/${id}`} replace />;
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/login', element: page(() => import('./pages/auth/LoginPage')) },
  { path: '/change-password', element: page(() => import('./pages/auth/ChangePasswordPage')) },
  { path: '/esign/:token', element: page(() => import('./pages/public/ESignPage')) },
  {
    path: '/portal',
    element: (
      <RequireAudience audience="PORTAL">
        <AppShell
          basePath="/portal"
          moduleName="Agent & Banca Portal"
          menu={PORTAL_MENU}
          profilePath="/portal/profile"
        />
      </RequireAudience>
    ),
    children: [
      { index: true, element: page(() => import('./pages/portal/DashboardPage')) },
      { path: 'quotations/new', element: page(() => import('./pages/portal/QuotationWizardPage')) },
      { path: 'policies', element: page(() => import('./pages/portal/PolicyListPage')) },
      { path: 'policies/:id', element: page(() => import('./pages/portal/PolicyDetailPage')) },
      { path: 'renewals', element: page(() => import('./pages/portal/RenewalsPage')) },
      { path: 'participants', element: page(() => import('./pages/portal/ParticipantListPage')) },
      {
        path: 'participants/new',
        element: page(() => import('./pages/portal/ParticipantFormPage')),
      },
      {
        path: 'participants/:id',
        element: page(() => import('./pages/portal/ParticipantDetailPage')),
      },
      { path: 'billing', element: page(() => import('./pages/portal/BillingPage')) },
      {
        path: 'billing/payments/:id',
        element: page(() => import('./pages/portal/PaymentDetailPage')),
      },
      { path: 'claims', element: page(() => import('./pages/portal/ClaimListPage')) },
      { path: 'claims/new', element: page(() => import('./pages/portal/ClaimFormPage')) },
      { path: 'claims/:id', element: page(() => import('./pages/portal/ClaimDetailPage')) },
      { path: 'requests', element: page(() => import('./pages/portal/RequestListPage')) },
      { path: 'requests/:id', element: page(() => import('./pages/portal/RequestDetailPage')) },
      { path: 'team', element: page(() => import('./pages/portal/TeamPage')) },
      {
        path: 'team/register',
        element: page(() => import('./pages/portal/AgentRegistrationPage')),
      },
      { path: 'team/:id', element: page(() => import('./pages/portal/TeamMemberPage')) },
      { path: 'hierarchy', element: <Navigate to="/portal/team" replace /> },
      { path: 'commission', element: page(() => import('./pages/portal/CommissionPage')) },
      { path: 'profile', element: page(() => import('./pages/portal/ProfilePage')) },
      { path: 'reports', element: page(() => import('./pages/common/ReportsPage')) },
      { path: 'issues', element: page(() => import('./pages/common/IssueListPage')) },
      { path: 'issues/:id', element: page(() => import('./pages/common/IssueDetailPage')) },
      { path: 'notifications', element: page(() => import('./pages/common/NotificationsPage')) },
    ],
  },
  {
    path: '/backoffice',
    element: (
      <RequireAudience audience="BACKOFFICE">
        <AppShell basePath="/backoffice" moduleName="Back-office" menu={BACKOFFICE_MENU} />
      </RequireAudience>
    ),
    children: [
      { index: true, element: page(() => import('./pages/backoffice/DashboardPage')) },
      { path: 'approvals', element: page(() => import('./pages/backoffice/ApprovalInboxPage')) },
      {
        path: 'approvals/:id',
        element: page(() => import('./pages/backoffice/ApprovalDetailPage')),
      },
      { path: 'requests/:id', element: <BackofficeRequestRedirect /> },
      { path: 'agents', element: page(() => import('./pages/backoffice/AgentListPage')) },
      { path: 'agents/new', element: page(() => import('./pages/backoffice/AgentRegisterPage')) },
      { path: 'agents/:id', element: page(() => import('./pages/backoffice/AgentDetailPage')) },
      { path: 'agencies', element: page(() => import('./pages/backoffice/AgencyListPage')) },
      { path: 'agencies/:id', element: page(() => import('./pages/backoffice/AgencyDetailPage')) },
      { path: 'policies', element: page(() => import('./pages/backoffice/PolicyListPage')) },
      { path: 'policies/:id', element: page(() => import('./pages/backoffice/PolicyDetailPage')) },
      {
        path: 'participants',
        element: page(() => import('./pages/backoffice/ParticipantListPage')),
      },
      {
        path: 'participants/:id',
        element: page(() => import('./pages/backoffice/ParticipantDetailPage')),
      },
      { path: 'payments', element: page(() => import('./pages/backoffice/PaymentListPage')) },
      { path: 'payments/:id', element: page(() => import('./pages/backoffice/PaymentDetailPage')) },
      { path: 'claims', element: page(() => import('./pages/backoffice/ClaimListPage')) },
      { path: 'claims/:id', element: page(() => import('./pages/backoffice/ClaimDetailPage')) },
      { path: 'aml', element: page(() => import('./pages/backoffice/AmlPage')) },
      { path: 'documents', element: page(() => import('./pages/backoffice/DocumentQueuePage')) },
      { path: 'audit', element: page(() => import('./pages/backoffice/AuditPage')) },
      { path: 'issues', element: page(() => import('./pages/common/IssueListPage')) },
      { path: 'issues/:id', element: page(() => import('./pages/common/IssueDetailPage')) },
      { path: 'reports', element: page(() => import('./pages/common/ReportsPage')) },
      { path: 'eod', element: page(() => import('./pages/backoffice/EodPage')) },
      { path: 'integration', element: page(() => import('./pages/backoffice/IntegrationPage')) },
      { path: 'users', element: page(() => import('./pages/backoffice/UsersPage')) },
      { path: 'roles', element: page(() => import('./pages/backoffice/RolesPage')) },
      { path: 'workflows', element: page(() => import('./pages/backoffice/WorkflowsPage')) },
      { path: 'products', element: page(() => import('./pages/backoffice/ProductsPage')) },
      { path: 'settings', element: page(() => import('./pages/backoffice/SettingsPage')) },
      { path: 'notifications', element: page(() => import('./pages/common/NotificationsPage')) },
    ],
  },
  { path: '*', element: page(() => import('./pages/common/NotFoundPage')) },
]);
