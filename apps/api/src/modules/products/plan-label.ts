import type { Prisma } from '../../generated/prisma/client.js';

interface NamedOption {
  code?: unknown;
  name?: unknown;
}

/**
 * Customer-facing description of the chosen plan and coverage type, e.g.
 * "Plan B / Family". Falls back to the stored codes when the product
 * configuration no longer lists them (plans can be retired after issuance).
 */
export function describePlan(
  productConfig: Prisma.JsonValue,
  planCode: string | null,
  coverageType: string | null,
): string | null {
  const config = (productConfig ?? {}) as { plans?: unknown; coverageTypes?: unknown };
  const parts = [nameOf(config.plans, planCode), nameOf(config.coverageTypes, coverageType)].filter(
    (part): part is string => Boolean(part),
  );
  return parts.length > 0 ? parts.join(' / ') : null;
}

function nameOf(options: unknown, code: string | null): string | null {
  if (!code) {
    return null;
  }
  const match = Array.isArray(options)
    ? (options as NamedOption[]).find((option) => option.code === code)
    : undefined;
  return typeof match?.name === 'string' ? match.name : code;
}
