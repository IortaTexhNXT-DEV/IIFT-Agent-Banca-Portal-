import type {
  ClaimStatus,
  NomineeRole,
  PaymentMethod,
  PaymentStatus,
  PolicyPaymentStatus,
  PolicyStatus,
} from '../../api/types';
import { humanise } from '../../utils/format';

function toOptions<T extends string>(values: readonly T[]): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: humanise(value) }));
}

export const POLICY_STATUS_OPTIONS = toOptions<PolicyStatus>([
  'DRAFT',
  'PENDING_APPROVAL',
  'PENDING_PAYMENT',
  'ACTIVE',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
]);
export const POLICY_PAYMENT_STATUS_OPTIONS = toOptions<PolicyPaymentStatus>([
  'UNPAID',
  'PENDING_VERIFICATION',
  'PAID',
]);
export const PAYMENT_STATUS_OPTIONS = toOptions<PaymentStatus>([
  'PENDING_VERIFICATION',
  'VERIFIED',
  'REJECTED',
]);
export const PAYMENT_METHOD_OPTIONS = toOptions<PaymentMethod>([
  'BANK_TRANSFER',
  'CHEQUE',
  'CASH_DEPOSIT',
  'ONLINE',
]);
export const CLAIM_STATUS_OPTIONS = toOptions<ClaimStatus>([
  'SUBMITTED',
  'UNDER_REVIEW',
  'ACKNOWLEDGED',
  'REJECTED',
  'CLOSED',
]);
export const NOMINEE_ROLE_OPTIONS = toOptions<NomineeRole>(['NOMINEE', 'BENEFICIARY', 'EXECUTOR']);

export const ID_TYPE_LABELS: Record<string, string> = {
  NRIC: 'IC (NRIC)',
  PASSPORT: 'Passport',
  BUSINESS_REG: 'Business registration',
};

/** Policy number once issued, otherwise the quotation number. */
export function policyReference(policy: { policyNo: string | null; quotationNo: string }): string {
  return policy.policyNo ?? policy.quotationNo;
}

/** 12 -> "1 year", 18 -> "18 months" */
export function formatTerm(months: number): string {
  if (months % 12 !== 0) return `${months} months`;
  const years = months / 12;
  return `${years} year${years === 1 ? '' : 's'}`;
}

export const ISO_DATE = 'YYYY-MM-DD';
