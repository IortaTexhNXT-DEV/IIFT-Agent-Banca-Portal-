import type { Money as MoneyValue } from '../api/types';
import { formatMoney } from '../utils/format';

export function Money({
  value,
  strong,
}: {
  value: MoneyValue | null | undefined;
  strong?: boolean;
}) {
  const text = formatMoney(value);
  return <span className={`money${strong ? ' money--strong' : ''}`}>{text}</span>;
}
