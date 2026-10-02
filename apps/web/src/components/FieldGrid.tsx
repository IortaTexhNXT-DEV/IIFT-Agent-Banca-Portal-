/**
 * FieldGrid – read-only record fields: small grey label above a 14px value, in a fixed
 * 2-, 3- or 4-column grid. Use it for every "label: value" block (record overviews,
 * summaries, approval details) instead of free text or inline "Label : value" rows.
 *
 *   <FieldGrid columns={3} items={[{ key: 'no', label: 'Policy no.', value: policy.policyNo }]} />
 *
 * Empty values render as "–". `span: 2` or `span: 'full'` widens long values (addresses).
 */
import type { CSSProperties, ReactNode } from 'react';

export interface FieldItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
  span?: 1 | 2 | 'full';
}

interface Props {
  items: (FieldItem | null | false | undefined | '')[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === '' || value === false;
}

const SPAN_CLASS = { 1: '', 2: ' field--span-2', full: ' field--full' } as const;

export function FieldGrid({ items, columns = 3, className }: Props) {
  return (
    <dl
      className={`field-grid${className ? ` ${className}` : ''}`}
      style={{ '--field-columns': columns } as CSSProperties}
    >
      {items
        .filter((item): item is FieldItem => Boolean(item))
        .map((item) => (
          <div key={item.key} className={`field${SPAN_CLASS[item.span ?? 1]}`}>
            <dt className="field__label">{item.label}</dt>
            <dd className="field__value">{isEmpty(item.value) ? '–' : item.value}</dd>
          </div>
        ))}
    </dl>
  );
}
