import { formatDate, formatDateTime, formatMoney, humanise, labelFromKey } from '../../utils/format';

const MONEY_KEY = /(amount|contribution|sumCovered|total|limit)$/i;
const ENUM_KEY = /(type|status|method|role|relationship|from|to|reason|reasonCode)$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ENUM_VALUE = /^[A-Z][A-Z0-9_]*$/;

/** Keys that carry no meaning for a reader (optimistic-lock versions, encrypted values). */
export function isHiddenKey(key: string): boolean {
  return key === 'version' || key.endsWith('Enc') || key.endsWith('Hash');
}

/** Labels that the generic camel-case conversion would get wrong. */
const KEY_LABELS: Record<string, string> = {
  policyNo: 'Policy no.',
  quotationNo: 'Quotation no.',
  paymentNo: 'Payment no.',
  referenceNo: 'Reference no.',
  receiptNo: 'Receipt no.',
  requestNo: 'Request no.',
  licenceNo: 'Licence no.',
  registrationNo: 'Registration no.',
  idNumber: 'ID number',
  idNumberMasked: 'ID number',
  idType: 'ID type',
  sharePercent: 'Share (%)',
  parentAgentId: 'Reports to (agent ID)',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  amlStatus: 'AML status',
};

/** Readable label for a JSON key, e.g. "referralReasons" -> "Referral reasons". */
export function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? labelFromKey(key.replace(/_/g, ' '));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Formats a scalar JSON value for display, using the key to recognise amounts and codes. */
export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number' || typeof value === 'string') {
    if (MONEY_KEY.test(key) && !Number.isNaN(Number(value))) return formatMoney(value);
    if (typeof value === 'string') {
      if (ISO_DATE.test(value)) return formatDate(value);
      if (ISO_DATE_TIME.test(value)) return value.includes('T00:00:00') ? formatDate(value) : formatDateTime(value);
      if (ENUM_VALUE.test(value) && (value.includes('_') || ENUM_KEY.test(key))) return humanise(value);
    }
    return String(value);
  }
  return JSON.stringify(value);
}
