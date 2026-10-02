import { render, screen } from '@testing-library/react';
import { CellText } from './CellText';

describe('CellText', () => {
  it('shows the text within the given width', () => {
    render(<CellText text="Awaiting signed proposal form" width={200} />);

    expect(screen.getByText('Awaiting signed proposal form')).toHaveStyle({ maxWidth: '200px' });
  });

  it('shows a dash when there is no text', () => {
    render(<CellText text={null} />);

    expect(screen.getByText('–')).toBeInTheDocument();
  });
});
