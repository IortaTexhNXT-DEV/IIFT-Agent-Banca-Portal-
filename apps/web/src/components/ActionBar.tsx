/**
 * ActionBar – the row of buttons that ends a form, wizard step or card.
 * Secondary actions (Back) go in `start`; the main actions are right-aligned with the
 * primary button last. `sticky` keeps the bar visible at the bottom of long forms inside a
 * card (it extends to the card edges).
 */
import type { ReactNode } from 'react';

interface Props {
  start?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
}

export function ActionBar({ start, children, sticky = false }: Props) {
  return (
    <div className={`action-bar${sticky ? ' action-bar--sticky' : ''}`}>
      {start && <div>{start}</div>}
      <div className="action-bar__end">{children}</div>
    </div>
  );
}
