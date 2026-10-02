import { render, screen } from '@testing-library/react';
import { FieldGrid } from './FieldGrid';

describe('FieldGrid', () => {
  it('pairs each label with its value', () => {
    render(
      <FieldGrid
        items={[
          { key: 'no', label: 'Policy no.', value: 'PRO/26/000001' },
          { key: 'term', label: 'Term', value: '1 year' },
        ]}
      />,
    );

    expect(screen.getByText('Policy no.').tagName).toBe('DT');
    expect(screen.getByText('Policy no.').nextElementSibling).toHaveTextContent('PRO/26/000001');
    expect(screen.getByText('Term').nextElementSibling).toHaveTextContent('1 year');
  });

  it('shows a dash for empty values and skips conditional items', () => {
    render(
      <FieldGrid
        items={[
          { key: 'email', label: 'E-mail', value: null },
          false,
          '',
          { key: 'no', label: 'Policy no.', value: '' },
        ]}
      />,
    );

    expect(screen.getAllByText('–')).toHaveLength(2);
    expect(screen.getAllByRole('term')).toHaveLength(2);
  });

  it('widens full-width fields across the grid', () => {
    render(<FieldGrid items={[{ key: 'a', label: 'Address', value: 'Jalan 1', span: 'full' }]} />);

    expect(screen.getByText('Address').parentElement).toHaveClass('field--full');
  });
});
