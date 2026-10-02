/**
 * FormSection – a titled group of form fields laid out on a fixed grid.
 *
 *   <Form layout="vertical" requiredMark="optional">
 *     <FormSection title="Participant" columns={2}>
 *       <Form.Item name="fullName" label="Full name" className="field--full">…</Form.Item>
 *       <Form.Item name="dateOfBirth" label="Date of birth">…</Form.Item>
 *     </FormSection>
 *     <ActionBar>…</ActionBar>
 *   </Form>
 *
 * Each direct child takes one grid cell, so short fields (dates, amounts, codes) never
 * stretch across the form; add className="field--full" to a Form.Item that needs the
 * whole row (addresses, remarks, choice cards).
 */
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  title?: ReactNode;
  /** Small control on the right of the title, e.g. an "Add nominee" button. */
  extra?: ReactNode;
  columns?: 1 | 2 | 3 | 4;
  children: ReactNode;
}

export function FormSection({ title, extra, columns = 2, children }: Props) {
  return (
    <section className="form-section">
      {(title || extra) && (
        <div className="form-section__head">
          {title && <h3 className="form-section__title">{title}</h3>}
          {extra}
        </div>
      )}
      <div className="form-grid" style={{ '--form-columns': columns } as CSSProperties}>
        {children}
      </div>
    </section>
  );
}
