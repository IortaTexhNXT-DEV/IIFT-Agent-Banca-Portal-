import type { Money as MoneyValue } from '../../api/types';
import { Money } from '../Money';
import '../../styles/sales.css';

interface Props {
  lines: { label: string; amount: string }[];
  contribution: MoneyValue;
  tabarru: MoneyValue;
  wakalahFee: MoneyValue;
}

/** Contribution lines, total and the Tabarru' / Wakalah split (FFR01..05). */
export function ContributionBreakdown({ lines, contribution, tabarru, wakalahFee }: Props) {
  return (
    <table className="breakdown">
      <caption className="sr-only">Contribution breakdown</caption>
      <tbody>
        {lines.map((line) => (
          <tr key={line.label}>
            <th scope="row">{line.label}</th>
            <td>
              <Money value={line.amount} />
            </td>
          </tr>
        ))}
        <tr className="breakdown__total">
          <th scope="row">Total contribution</th>
          <td>
            <Money value={contribution} strong />
          </td>
        </tr>
        <tr className="breakdown__split">
          <th scope="row">Tabarru&apos; (participants&apos; risk fund)</th>
          <td>
            <Money value={tabarru} />
          </td>
        </tr>
        <tr className="breakdown__split">
          <th scope="row">Wakalah fee (operator)</th>
          <td>
            <Money value={wakalahFee} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
