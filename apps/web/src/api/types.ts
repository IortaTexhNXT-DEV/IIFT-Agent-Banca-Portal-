/**
 * Shapes of the API responses used by the UI. Decimal amounts are serialised by the
 * API as strings to avoid floating-point loss; format them with utils/format.
 */

export type Money = string | number;
export type IsoDate = string;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type Audience = 'PORTAL' | 'BACKOFFICE';
export type UserType = 'AGENT' | 'BANCA' | 'STAFF';

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  userType: UserType;
  audience: Audience;
  permissions: string[];
  agentId?: string;
  agencyId?: string;
  mustChangePassword: boolean;
}

export interface AuthResponse {
  user: SessionUser;
  csrfToken: string;
}

export type PolicyStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CANCELLED';
export type PolicyPaymentStatus = 'UNPAID' | 'PENDING_VERIFICATION' | 'PAID';
export type AgentStatus =
  'PENDING' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'REJECTED';
export type AgentType = 'MAIN_AGENT' | 'SUB_AGENT' | 'BANKER';
export type Channel = 'AGENCY' | 'BANCA';
export type AmlStatus = 'NOT_SCREENED' | 'CLEAR' | 'FLAGGED' | 'REJECTED';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
export type ApprovalType =
  | 'AGENT_REGISTRATION'
  | 'AGENT_PROFILE_UPDATE'
  | 'AGENT_STATUS_CHANGE'
  | 'PARTICIPANT_UPDATE'
  | 'POLICY_REFERRAL'
  | 'POLICY_ENDORSEMENT'
  | 'POLICY_CANCELLATION'
  | 'PAYMENT_VERIFICATION';
export type PaymentStatus = 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
export type PaymentMethod = 'BANK_TRANSFER' | 'CHEQUE' | 'CASH_DEPOSIT' | 'ONLINE';
export type ClaimStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'ACKNOWLEDGED' | 'REJECTED' | 'CLOSED';
export type IssuePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IssueStatus = 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type DocumentOwnerType =
  'AGENT' | 'AGENCY' | 'PARTICIPANT' | 'POLICY' | 'PAYMENT' | 'CLAIM' | 'ISSUE' | 'REPORT';
export type DocumentStatus = 'UPLOADED' | 'VERIFIED' | 'REJECTED';
export type NomineeRole = 'NOMINEE' | 'BENEFICIARY' | 'EXECUTOR';

export interface CodeItem {
  id: string;
  category: string;
  code: string;
  label: string;
  active: boolean;
  sortOrder: number;
}

export interface RiskField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required?: boolean;
  min?: number;
  max?: number;
  mustBeTrue?: boolean;
}

export interface ProductPlan {
  code: string;
  name: string;
  sumCovered: number;
  contributions: Record<string, number>;
  additionalCover?: { name: string; amount: number };
}

export interface ProductConfig {
  plans?: ProductPlan[];
  terms?: number[];
  coverageTypes?: { code: string; name: string; loading: number }[];
  riskFields?: RiskField[];
  highRiskLimit?: number;
  requiresNominee?: boolean;
  qualityCheck?: boolean;
  [key: string]: unknown;
}

export interface RequiredDocument {
  docType: string;
  label: string;
  mandatory: boolean;
}

export interface Question {
  code: string;
  text: string;
  referIfYes: boolean;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  lineOfBusiness: string;
  description: string;
  ratingEngine: 'FINANCING' | 'FIXED_PLAN';
  config: ProductConfig;
  requiredDocuments: RequiredDocument[];
  questionnaire: Question[];
  paymentBeforeIssuance: boolean;
  allowRenewal: boolean;
  active: boolean;
  sortOrder: number;
}

export interface QuoteResult {
  planCode: string | null;
  coverageType: string | null;
  termMonths: number;
  sumCovered: Money;
  contribution: Money;
  lines: { label: string; amount: string }[];
  tabarru: Money;
  wakalahFee: Money;
  riskDetails: Record<string, string | number | boolean>;
  referralReasons: string[];
  commissionRate: number;
}

export interface Ref {
  id: string;
  code?: string;
  name?: string;
}

export interface PolicySummary {
  id: string;
  quotationNo: string;
  policyNo: string | null;
  status: PolicyStatus;
  paymentStatus: PolicyPaymentStatus;
  sumCovered: Money;
  contribution: Money;
  outstandingAmount: Money;
  paymentDueDate: IsoDate | null;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  createdAt: IsoDate;
  issuedAt: IsoDate | null;
  product: { id: string; code: string; name: string };
  participant: { id: string; participantNo: string; fullName: string };
  agent: { id: string; agentCode: string; fullName: string };
  agency: { id: string; code: string; name: string };
}

export interface PolicyEvent {
  id: string;
  action: string;
  fromStatus: PolicyStatus | null;
  toStatus: PolicyStatus | null;
  remarks: string | null;
  actorName: string | null;
  createdAt: IsoDate;
}

export interface Nominee {
  id: string;
  fullName: string;
  relationship: string;
  role: NomineeRole;
  sharePercent: Money;
  idNumberMasked: string | null;
}

export interface DocumentView {
  id: string;
  ownerType: DocumentOwnerType;
  ownerId: string;
  docType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  expiryDate: IsoDate | null;
  remarks: string | null;
  systemGenerated: boolean;
  uploadedById: string | null;
  verifiedAt: IsoDate | null;
  createdAt: IsoDate;
  expired: boolean;
}

export interface ApprovalAction {
  id: string;
  level: number;
  action: 'SUBMIT' | 'APPROVE' | 'REJECT' | 'WITHDRAW';
  actorName: string;
  remarks: string | null;
  createdAt: IsoDate;
}

export interface ApprovalRequest {
  id: string;
  requestNo: string;
  type: ApprovalType;
  entityType: string;
  entityId: string;
  summary: string;
  payload: Record<string, unknown>;
  amount: Money | null;
  status: ApprovalStatus;
  currentLevel: number;
  totalLevels: number;
  levelPermissions: string[];
  makerId: string;
  makerName: string;
  agencyId: string | null;
  submittedAt: IsoDate;
  decidedAt: IsoDate | null;
  finalRemarks: string | null;
  actions?: ApprovalAction[];
}

export interface Participant {
  id: string;
  participantNo: string;
  type: 'INDIVIDUAL' | 'CORPORATE';
  fullName: string;
  idType: 'NRIC' | 'PASSPORT' | 'BUSINESS_REG';
  idNumberMasked: string;
  dateOfBirth: IsoDate | null;
  ageNextBirthday: number | null;
  gender: string | null;
  nationality: string | null;
  occupation: string | null;
  occupationClass: number | null;
  email: string | null;
  mobile: string;
  addressLine1: string;
  addressLine2: string | null;
  postcode: string | null;
  district: string | null;
  contactPerson: string | null;
  amlStatus: AmlStatus;
  amlScreenedAt: IsoDate | null;
  createdAt: IsoDate;
  version: number;
}

export interface PolicyDetail extends Omit<
  PolicySummary,
  'product' | 'participant' | 'agent' | 'agency'
> {
  planCode: string | null;
  coverageType: string | null;
  termMonths: number;
  contributionBreakdown: {
    lines: { label: string; amount: string }[];
    tabarru: string;
    wakalahFee: string;
    commissionRate: number;
  };
  riskDetails: Record<string, string | number | boolean>;
  questionnaire: { code: string; answer: boolean; details?: string }[] | null;
  referralReasons: string[];
  submittedAt: IsoDate | null;
  approvedAt: IsoDate | null;
  rejectedReason: string | null;
  cancelledAt: IsoDate | null;
  cancellationReason: string | null;
  version: number;
  product: Product;
  participant: Participant;
  agent: { id: string; agentCode: string; fullName: string; authorityLimit: Money | null };
  agency: { id: string; code: string; name: string; issuanceBlocked: boolean };
  nominees: Nominee[];
  events: PolicyEvent[];
  allocations: {
    id: string;
    amount: Money;
    payment: {
      id: string;
      paymentNo: string;
      status: PaymentStatus;
      paymentDate: IsoDate;
      method: PaymentMethod;
      referenceNo: string;
    };
  }[];
  receipts: {
    id: string;
    receiptNo: string;
    amount: Money;
    issuedAt: IsoDate;
    documentId: string | null;
  }[];
  claims: {
    id: string;
    claimNo: string;
    claimType: string;
    status: ClaimStatus;
    eventDate: IsoDate;
  }[];
  signatures: {
    id: string;
    recipientName: string;
    recipientEmail: string;
    expiresAt: IsoDate;
    signedAt: IsoDate | null;
    createdAt: IsoDate;
  }[];
  renewalOf: { id: string; policyNo: string | null } | null;
  documents: DocumentView[];
  approvals: ApprovalRequest[];
  missingDocuments: string[];
}

export interface AgentView {
  id: string;
  agentCode: string;
  agencyId: string;
  agentType: AgentType;
  parentAgentId: string | null;
  fullName: string;
  idType: string;
  idNumberMasked: string;
  dateOfBirth: IsoDate | null;
  email: string;
  mobile: string;
  address: string | null;
  branchName: string | null;
  licenceNo: string | null;
  licenceExpiry: IsoDate | null;
  status: AgentStatus;
  statusReason: string | null;
  amlStatus: AmlStatus;
  authorityLimit: Money | null;
  activatedAt: IsoDate | null;
  createdAt: IsoDate;
  version: number;
  agency: {
    id: string;
    code: string;
    name: string;
    channel: Channel;
    status: string;
    issuanceBlocked: boolean;
  };
  parent: { id: string; agentCode: string; fullName: string } | null;
  user: { id: string; username: string; status: string; lastLoginAt: IsoDate | null } | null;
}

export interface AgentDetail extends AgentView {
  subAgents: {
    id: string;
    agentCode: string;
    fullName: string;
    status: AgentStatus;
    agentType: AgentType;
  }[];
  documents: DocumentView[];
  approvals: ApprovalRequest[];
  screenings?: AmlScreening[];
}

export interface HierarchyNode {
  id: string;
  agentCode: string;
  fullName: string;
  agentType: AgentType;
  status: AgentStatus;
  parentAgentId: string | null;
  branchName: string | null;
  children: HierarchyNode[];
}

export interface Agency {
  id: string;
  code: string;
  name: string;
  channel: Channel;
  registrationNo: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  issuanceBlocked: boolean;
  issuanceBlockedAt: IsoDate | null;
  issuanceBlockReason: string | null;
  activeAgents?: number;
  agentsByStatus?: Record<string, number>;
  outstandingPolicies?: number;
  outstandingAmount?: Money;
}

export interface AmlScreening {
  id: string;
  subjectType: 'AGENT' | 'PARTICIPANT';
  subjectId: string;
  subjectName: string;
  provider: string;
  score: number;
  matches: {
    listName: string;
    name: string;
    score: number;
    reference?: string | null;
    reason: string;
  }[];
  status: 'AUTO_CLEARED' | 'PENDING_REVIEW' | 'CLEARED' | 'CONFIRMED_MATCH';
  reviewedAt: IsoDate | null;
  reviewRemarks: string | null;
  createdAt: IsoDate;
}

export interface Payment {
  id: string;
  paymentNo: string;
  agencyId: string;
  method: PaymentMethod;
  bankName: string | null;
  referenceNo: string;
  paymentDate: IsoDate;
  totalAmount: Money;
  status: PaymentStatus;
  remarks: string | null;
  verifiedAt: IsoDate | null;
  rejectionReason: string | null;
  createdAt: IsoDate;
  agency: { id: string; code: string; name: string };
  allocations: {
    id: string;
    amount: Money;
    policy: {
      id: string;
      policyNo: string | null;
      quotationNo: string;
      participant: { fullName: string };
    };
  }[];
  receipts: {
    id: string;
    receiptNo: string;
    policyId: string;
    amount: Money;
    issuedAt: IsoDate;
    documentId: string | null;
  }[];
  documents?: DocumentView[];
  approvals?: ApprovalRequest[];
}

export interface OutstandingPolicy {
  id: string;
  policyNo: string | null;
  quotationNo: string;
  status: PolicyStatus;
  paymentStatus: PolicyPaymentStatus;
  contribution: Money;
  outstandingAmount: Money;
  paymentDueDate: IsoDate | null;
  issuedAt: IsoDate | null;
  overdue: boolean;
  product: { code: string; name: string };
  participant: { fullName: string };
  agent: { agentCode: string; fullName: string };
}

export interface OutstandingResponse {
  summary: {
    outstandingCount: number;
    outstandingAmount: Money;
    overdueCount: number;
    overdueAmount: Money;
    dueSoonCount: number;
    pendingVerificationCount: number;
    issuanceBlocked: boolean;
    blockReason: string | null;
  };
  policies: OutstandingPolicy[];
}

export interface Claim {
  id: string;
  claimNo: string;
  policyId: string;
  claimType: string;
  eventDate: IsoDate;
  description: string;
  claimedAmount: Money | null;
  status: ClaimStatus;
  remarks: string | null;
  createdAt: IsoDate;
  policy: {
    id: string;
    policyNo: string | null;
    startDate: IsoDate | null;
    endDate: IsoDate | null;
    product: { code: string; name: string };
    participant: { fullName: string; participantNo: string };
    agent: { agentCode: string; fullName: string };
    agency: { code: string; name: string };
  };
  documents?: DocumentView[];
}

export interface Issue {
  id: string;
  issueNo: string;
  title: string;
  description: string;
  category: string;
  priority: IssuePriority;
  status: IssueStatus;
  reportedById: string;
  reportedByName: string;
  assignedToId: string | null;
  assignedToName: string | null;
  assignedTeam: string | null;
  responseDueAt: IsoDate;
  resolutionDueAt: IsoDate;
  firstRespondedAt: IsoDate | null;
  resolvedAt: IsoDate | null;
  slaBreached: boolean;
  resolution: string | null;
  createdAt: IsoDate;
  comments?: {
    id: string;
    authorName: string;
    body: string;
    internal: boolean;
    createdAt: IsoDate;
  }[];
  documents?: DocumentView[];
}

export interface NotificationItem {
  id: string;
  eventType: string;
  subject: string;
  body: string;
  link: string | null;
  readAt: IsoDate | null;
  createdAt: IsoDate;
}

export interface ReportDefinition {
  code: string;
  name: string;
  description: string;
  audiences: Audience[];
  filters: ('dateRange' | 'product' | 'agency' | 'agent' | 'status')[];
  statusOptions?: string[];
  dateLabel?: string;
  columns: {
    key: string;
    header: string;
    type: 'text' | 'number' | 'money' | 'date' | 'datetime';
    width?: number;
  }[];
}

export interface ReportPreview {
  columns: ReportDefinition['columns'];
  rows: Record<string, string | number | null>[];
  truncated: boolean;
}

export interface MonthlyPoint {
  month: string;
  policies: number;
  contribution: number;
}

export interface PortalDashboard {
  profile: {
    fullName: string;
    agentCode: string;
    agentType: AgentType;
    status: AgentStatus;
    reportsTo: string | null;
    agency: {
      name: string;
      code: string;
      channel: Channel;
      issuanceBlocked: boolean;
      issuanceBlockReason: string | null;
    };
  };
  counts: {
    draft: number;
    pendingApproval: number;
    pendingPayment: number;
    active: number;
    rejected: number;
    expired: number;
    renewalsDue: number;
    overdue: number;
    outstandingCount: number;
    outstandingAmount: Money;
    unreadNotifications: number;
    openIssues: number;
  };
  pendingActions: { type: string; title: string; detail: string; link: string }[];
  monthly: MonthlyPoint[];
  recentActivity: {
    id: string;
    action: string;
    remarks: string | null;
    actorName: string | null;
    createdAt: IsoDate;
    policyId: string;
    reference: string;
  }[];
}

export interface BackofficeDashboard {
  pending: {
    myApprovals: number;
    myApprovalItems: ApprovalRequest[];
    pendingByType: Partial<Record<ApprovalType, number>>;
    pendingAgents: number;
    amlReview: number;
    documentsToVerify: number;
    paymentsPending: number;
    paymentsPendingAmount: Money;
    claimsOpen: number;
    issuesOpen: number;
    issuesBreached: number;
    integrationDead: number;
  };
  kpis?: {
    policiesMtd: number;
    contributionMtd: Money;
    policiesYtd: number;
    contributionYtd: Money;
    activeAgents: number;
    activeAgencies: number;
    outstandingAmount: Money;
    overdueAmount: Money;
    overdueCount: number;
  };
  blockedAgencies?: {
    id: string;
    code: string;
    name: string;
    issuanceBlockedAt: IsoDate | null;
    issuanceBlockReason: string | null;
  }[];
  trend?: MonthlyPoint[];
  byProduct?: { code: string; name: string; policies: number; contribution: Money }[];
  byChannel?: { channel: Channel; policies: number; contribution: Money }[];
}
