/**
 * Response and request shapes for the sales and policy domain (quotations, policies,
 * participants, billing, claims, e-signature) that are not in the shared api/types.ts.
 */
import type {
  AmlScreening,
  AmlStatus,
  ApprovalRequest,
  Channel,
  DocumentView,
  IsoDate,
  Money,
  NomineeRole,
  Page,
  Participant,
  PolicyPaymentStatus,
  PolicyStatus,
} from './types';

/** Body of POST /portal/policies/calculate and PUT /portal/policies/:id (without the ids). */
export interface QuoteOptions {
  planCode?: string;
  coverageType?: string;
  termMonths?: number;
  additionalCover?: boolean;
  startDate?: string;
  riskDetails: Record<string, string | number | boolean>;
}

export interface QuoteRequest extends QuoteOptions {
  productId: string;
  participantId: string;
}

export interface NomineeInput {
  fullName: string;
  idNumber?: string;
  relationship: string;
  role: NomineeRole;
  sharePercent: number;
}

export interface QuestionnaireAnswer {
  code: string;
  answer: boolean;
  details?: string;
}

/** Minimal masked summary returned by the exact-ID lookup (single shared profile). */
export interface ParticipantMatch {
  id: string;
  participantNo: string;
  fullName: string;
  idNumberMasked: string;
  amlStatus: AmlStatus;
}

export type ParticipantLookup = { found: false } | { found: true; participant: ParticipantMatch };

export interface ParticipantPolicy {
  id: string;
  quotationNo: string;
  policyNo: string | null;
  status: PolicyStatus;
  paymentStatus: PolicyPaymentStatus;
  contribution: Money;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  product: { code: string; name: string };
  agency: { name: string };
  agent: { agentCode: string; fullName: string };
}

export interface ParticipantDetail extends Participant {
  policies: ParticipantPolicy[];
  documents: DocumentView[];
  approvals: ApprovalRequest[];
  /** Back-office only; empty for portal users. */
  screenings: AmlScreening[];
}

/** Fields of CreateParticipantDto. */
export interface ParticipantInput {
  type: Participant['type'];
  fullName: string;
  idType: Participant['idType'];
  idNumber: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  occupation?: string;
  occupationClass?: number;
  email?: string;
  mobile: string;
  addressLine1: string;
  addressLine2?: string;
  postcode?: string;
  district?: string;
  contactPerson?: string;
}

export type CommissionStatus = 'ACCRUED' | 'PAID';

export interface Commission {
  id: string;
  period: string;
  contribution: Money;
  rate: Money;
  amount: Money;
  status: CommissionStatus;
  paidAt: IsoDate | null;
  source: string;
  createdAt: IsoDate;
  agent: { agentCode: string; fullName: string };
  policy: { policyNo: string | null; product: { name: string } };
}

export interface CommissionPage extends Page<Commission> {
  totals: Partial<Record<CommissionStatus, Money>>;
}

/** GET /portal/claims/validate-policy */
export interface ClaimablePolicy {
  id: string;
  policyNo: string;
  status: PolicyStatus;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  sumCovered: Money;
  product: { name: string };
  participant: { fullName: string };
}

/** GET /public/esign/:token */
export interface ESignSummary {
  quotationNo: string;
  participantName: string;
  product: string;
  plan: string | null;
  sumCovered: string;
  contribution: string;
  termMonths: number;
  agentName: string;
  expiresAt: IsoDate;
}

export interface AgencyOption {
  id: string;
  code: string;
  name: string;
  channel: Channel;
}

export interface SentTo {
  sentTo: string;
}
