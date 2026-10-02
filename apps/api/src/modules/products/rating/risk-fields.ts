import { BusinessRuleError } from '../../../common/http/errors.js';

/** Product-specific details captured with the quotation (e.g. financier, passport, institution). */
export interface RiskFieldDefinition {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  min?: number;
  max?: number;
  /** Eligibility condition, e.g. "registered as a student" must be confirmed. */
  mustBeTrue?: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates and normalises risk details against the product's field definitions.
 * Unknown keys are dropped, so arbitrary data can never be stored on a policy.
 */
export function readRiskFields(
  fields: RiskFieldDefinition[],
  input: Record<string, unknown>,
): {
  values: Record<string, string | number | boolean>;
  errors: string[];
} {
  const values: Record<string, string | number | boolean> = {};
  const errors: string[] = [];
  for (const field of fields) {
    const raw = input[field.key];
    if (raw === undefined || raw === null || raw === '') {
      if (field.required || field.mustBeTrue) errors.push(`${field.label} is required`);
      continue;
    }
    switch (field.type) {
      case 'number': {
        const value = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(value)) {
          errors.push(`${field.label} must be a number`);
        } else if (field.min !== undefined && value < field.min) {
          errors.push(`${field.label} must be at least ${field.min.toLocaleString('en-GB')}`);
        } else if (field.max !== undefined && value > field.max) {
          errors.push(`${field.label} must not exceed ${field.max.toLocaleString('en-GB')}`);
        } else {
          values[field.key] = value;
        }
        break;
      }
      case 'boolean':
        if (typeof raw !== 'boolean') errors.push(`${field.label} must be yes or no`);
        else if (field.mustBeTrue && !raw) errors.push(`Eligibility: ${field.label}`);
        else values[field.key] = raw;
        break;
      case 'date':
        if (typeof raw !== 'string' || !DATE_PATTERN.test(raw) || Number.isNaN(Date.parse(raw)))
          errors.push(`${field.label} must be a date (YYYY-MM-DD)`);
        else values[field.key] = raw;
        break;
      default:
        if (typeof raw !== 'string' || raw.trim().length > 200)
          errors.push(`${field.label} must be text of up to 200 characters`);
        else values[field.key] = raw.trim();
    }
  }
  return { values, errors };
}

export function assertEligible(errors: string[]): void {
  if (errors.length > 0) {
    throw new BusinessRuleError(
      'NOT_ELIGIBLE',
      'The quotation does not meet the product rules',
      errors,
    );
  }
}

export function readRiskFieldDefinitions(raw: unknown): RiskFieldDefinition[] {
  if (raw === undefined) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new Error('config.riskFields must be an array');
  }
  return raw.map((item, index) => {
    const field = item as Partial<RiskFieldDefinition>;
    if (
      !field.key ||
      !/^[a-zA-Z][a-zA-Z0-9]{1,40}$/.test(field.key) ||
      !field.label ||
      !['string', 'number', 'date', 'boolean'].includes(field.type ?? '')
    ) {
      throw new Error(
        `config.riskFields[${index}] needs a key, label and type (string, number, date or boolean)`,
      );
    }
    return {
      key: field.key,
      label: field.label,
      type: field.type!,
      required: field.required !== false,
      min: field.min,
      max: field.max,
      mustBeTrue: field.mustBeTrue === true,
    };
  });
}
