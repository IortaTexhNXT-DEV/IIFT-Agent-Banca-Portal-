/**
 * Response shapes used by the distribution, control, operations and administration
 * screens that are not already covered by api/types.ts.
 */
import type {
  AgentType,
  ApprovalAction,
  ApprovalRequest,
  Audience,
  Channel,
  IsoDate,
  Money,
  UserType,
} from './types';

export interface AgencyOption {
  id: string;
  code: string;
  name: string;
  channel: Channel;
}

/** Body of POST /portal/agents (RegisterAgentDto) and POST /backoffice/agents. */
export interface RegisterAgentInput {
  agentType: AgentType;
  parentAgentId?: string;
  fullName: string;
  idType: 'NRIC' | 'PASSPORT';
  idNumber: string;
  dateOfBirth: string;
  email: string;
  mobile: string;
  address?: string;
  branchName?: string;
  licenceNo?: string;
  licenceExpiry?: string;
  authorityLimit?: number;
  agencyId?: string;
}

/** Changes accepted by POST /backoffice/agents/:id/update-requests (UpdateAgentDto). */
export interface AgentUpdateInput {
  fullName?: string;
  email?: string;
  mobile?: string;
  address?: string;
  branchName?: string;
  dateOfBirth?: string;
  licenceNo?: string;
  licenceExpiry?: string;
  authorityLimit?: number | null;
  parentAgentId?: string | null;
}

export type ManagedAgentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';

export interface AgencyInput {
  name: string;
  registrationNo?: string;
  email?: string;
  phone?: string;
  address?: string;
  code?: string;
  channel?: Channel;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface WatchlistEntry {
  id: string;
  listName: string;
  fullName: string;
  idNumber: string | null;
  country: string | null;
  reference: string | null;
  active: boolean;
  createdAt: IsoDate;
}

export interface AuditRecord {
  id: string;
  occurredAt: IsoDate;
  actorId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
}

export interface AuditFacets {
  actions: string[];
  entityTypes: string[];
}

export interface EodRun {
  id: string;
  businessDate: IsoDate;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  startedAt: IsoDate;
  finishedAt: IsoDate | null;
  policiesIssued: number;
  receiptsIssued: number;
  totalContribution: Money;
  totalReceipts: Money;
  reportDocumentId: string | null;
  finFileDocumentId: string | null;
  errorMessage: string | null;
  triggeredBy: string;
}

export type IntegrationSystem = 'CORE' | 'FINANCE' | 'AML' | 'EMAIL' | 'SMS' | 'DIRECTORY';
export type OutboxStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DEAD';

export interface IntegrationSummary {
  system: IntegrationSystem;
  successCount: number;
  failureCount: number;
  successRate: number | null;
  averageMs: number | null;
  pending: number;
  retrying: number;
  deadLetter: number;
}

export interface OutboxMessage {
  id: string;
  system: IntegrationSystem;
  operation: string;
  payload: unknown;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: IsoDate;
  lastError: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
  correlationId: string | null;
  createdAt: IsoDate;
  processedAt: IsoDate | null;
}

export interface IntegrationLogEntry {
  id: string;
  system: IntegrationSystem;
  operation: string;
  direction: 'OUTBOUND' | 'INBOUND';
  success: boolean;
  durationMs: number;
  reference: string | null;
  requestSummary: string | null;
  responseSummary: string | null;
  errorMessage: string | null;
  outboxId: string | null;
  createdAt: IsoDate;
}

export interface ReconciliationRun {
  id: string;
  businessDate: IsoDate;
  system: IntegrationSystem;
  expectedCount: number;
  matchedCount: number;
  expectedAmount: Money;
  matchedAmount: Money;
  status: 'MATCHED' | 'MISMATCH';
  details: { unmatchedReceipts?: string[] } | null;
  createdAt: IsoDate;
}

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'DISABLED';

export interface UserSummary {
  id: string;
  username: string;
  fullName: string;
  email: string;
  mobile: string | null;
  userType: UserType;
  status: UserStatus;
  authSource: 'LOCAL' | 'DIRECTORY';
  lastLoginAt: IsoDate | null;
  lockedUntil: IsoDate | null;
  mustChangePassword: boolean;
  createdAt: IsoDate;
  agent: { id: string; agentCode: string; agency: { code: string; name: string } } | null;
  roles: { role: { id: string; code: string; name: string } }[];
}

export interface TemporaryPassword {
  temporaryPassword?: string;
}

export interface CreatedUser extends TemporaryPassword {
  user: UserSummary;
}

export interface RoleOption {
  id: string;
  code: string;
  name: string;
  audience: Audience;
}

export interface Role extends RoleOption {
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

export interface PermissionDefinition {
  code: string;
  audience: Audience;
  group: string;
  description: string;
}

export interface WorkflowStep {
  id: string;
  level: number;
  name: string;
  permission: string;
  minAmount: Money | null;
}

export interface WorkflowDefinition {
  id: string;
  type: string;
  name: string;
  description: string | null;
  active: boolean;
  updatedAt: IsoDate;
  steps: WorkflowStep[];
}

export interface ConfigParameter {
  key: string;
  value: string;
  valueType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN';
  category: string;
  description: string;
  minValue: Money | null;
  maxValue: Money | null;
  updatedAt: IsoDate;
}

export type ExportFormat = 'XLSX' | 'CSV' | 'PDF';
export type ReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type SchedulePeriod =
  'PREVIOUS_DAY' | 'PREVIOUS_7_DAYS' | 'PREVIOUS_MONTH' | 'MONTH_TO_DATE';

export interface ReportSchedule {
  id: string;
  reportCode: string;
  name: string;
  frequency: ReportFrequency;
  format: ExportFormat;
  recipients: string[];
  filters: { period?: SchedulePeriod };
  active: boolean;
  lastRunAt: IsoDate | null;
  nextRunAt: IsoDate;
  createdAt: IsoDate;
}

export interface Assignee {
  id: string;
  fullName: string;
  username: string;
}

/** Approval request as returned by the detail endpoints, whose actions carry the actor id. */
export interface ApprovalRequestDetail extends ApprovalRequest {
  actions?: (ApprovalAction & { actorId: string })[];
}
