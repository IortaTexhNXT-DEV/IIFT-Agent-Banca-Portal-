import dayjs from 'dayjs';
import type { Money } from '../api/types';

const moneyFormat = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const integerFormat = new Intl.NumberFormat('en-GB');

/** B$ 1,234.50 */
export function formatMoney(value: Money | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–';
  return `B$ ${moneyFormat.format(Number(value))}`;
}

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '–';
  return integerFormat.format(Number(value));
}

/** 02 Oct 2026 */
export function formatDate(value: string | null | undefined): string {
  return value ? dayjs(value).format('DD MMM YYYY') : '–';
}

/** 02 Oct 2026, 14:05 */
export function formatDateTime(value: string | null | undefined): string {
  return value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '–';
}

/** "PENDING_APPROVAL" -> "Pending approval" */
export function humanise(value: string | null | undefined): string {
  if (!value) return '–';
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "financingAmount" -> "Financing amount" */
export function labelFromKey(key: string): string {
  const text = key.replace(/([A-Z])/g, ' $1').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
