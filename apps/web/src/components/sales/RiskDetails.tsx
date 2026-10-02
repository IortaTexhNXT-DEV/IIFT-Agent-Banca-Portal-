import type { RiskField } from '../../api/types';
import { formatDate, formatNumber, labelFromKey } from '../../utils/format';
import { EmptyState } from '../EmptyState';
import { type FieldItem, FieldGrid } from '../FieldGrid';

interface Props {
  details: Record<string, string | number | boolean>;
  /** Product field definitions, used for labels and value types where available. */
  fields?: RiskField[];
}

function displayValue(value: string | number | boolean, field: RiskField | undefined): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return formatNumber(value);
  return field?.type === 'date' ? formatDate(value) : value;
}

/** Field items for risk details, labelled from the product field definitions where available. */
export function riskDetailItems(details: Props['details'], fields: RiskField[] = []): FieldItem[] {
  const definitions = new Map(fields.map((field) => [field.key, field]));
  return Object.entries(details).map(([key, value]) => {
    const field = definitions.get(key);
    return { key, label: field?.label ?? labelFromKey(key), value: displayValue(value, field) };
  });
}

/** Product-specific details captured with the quotation (financing, helper, student etc.). */
export function RiskDetails({ details, fields }: Props) {
  if (Object.keys(details).length === 0) {
    return <EmptyState label="No additional details" inline />;
  }
  return <FieldGrid columns={3} items={riskDetailItems(details, fields)} />;
}
