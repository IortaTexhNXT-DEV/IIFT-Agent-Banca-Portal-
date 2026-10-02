import { Descriptions, type DescriptionsProps, Empty } from 'antd';
import type { RiskField } from '../../api/types';
import { formatDate, formatNumber, labelFromKey } from '../../utils/format';

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

/** Description items for risk details, labelled from the product field definitions where available. */
export function riskDetailItems(details: Props['details'], fields: RiskField[] = []): NonNullable<DescriptionsProps['items']> {
  const definitions = new Map(fields.map((field) => [field.key, field]));
  return Object.entries(details).map(([key, value]) => {
    const field = definitions.get(key);
    return { key, label: field?.label ?? labelFromKey(key), children: displayValue(value, field) };
  });
}

/** Product-specific details captured with the quotation (financing, helper, student etc.). */
export function RiskDetails({ details, fields }: Props) {
  if (Object.keys(details).length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No additional details for this product" />;
  }
  return <Descriptions size="small" column={{ xs: 1, md: 2 }} items={riskDetailItems(details, fields)} />;
}
