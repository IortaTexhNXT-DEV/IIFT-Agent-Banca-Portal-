import { Prisma } from '../../generated/prisma/client.js';

/** Monetary helpers. Amounts are kept as Decimal end-to-end; never as binary floats in storage. */

export type Money = Prisma.Decimal;
export type DecimalInput = Prisma.Decimal | number | string;

export function money(value: DecimalInput): Money {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export const ZERO = money(0);

export function sum(values: DecimalInput[]): Money {
  return money(
    values.reduce<Prisma.Decimal>((total, value) => total.plus(value), new Prisma.Decimal(0)),
  );
}
