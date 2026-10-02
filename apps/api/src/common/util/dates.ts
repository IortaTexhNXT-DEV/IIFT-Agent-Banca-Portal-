/** Date helpers. Business dates are calendar dates in the Brunei time zone (UTC+8, no DST). */

export const BUSINESS_TIME_ZONE = 'Asia/Brunei';

const BRUNEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** Today's business date as a UTC-midnight Date, suitable for @db.Date columns. */
export function businessToday(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + BRUNEI_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getTime());
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/** Start and end (exclusive) instants of a business date. */
export function businessDayRange(businessDate: Date): { from: Date; to: Date } {
  const from = new Date(businessDate.getTime() - BRUNEI_OFFSET_MS);
  return { from, to: new Date(from.getTime() + DAY_MS) };
}

/** Age at next birthday — the age basis used by IIFT rating (Appendix 3, FFR01). */
export function ageNextBirthday(dateOfBirth: Date, onDate: Date): number {
  let age = onDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayPassed =
    onDate.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (onDate.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      onDate.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!birthdayPassed) {
    age -= 1;
  }
  return age + 1;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a YYYY-MM-DD string to a UTC-midnight Date. */
export function parseIsoDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return date;
}
