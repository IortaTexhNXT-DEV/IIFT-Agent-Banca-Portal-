import { render, screen } from '@testing-library/react';
import { Money } from './Money';

describe('Money', () => {
  it('shows the formatted amount', () => {
    render(<Money value="1234.5" />);

    const amount = screen.getByText('B$ 1,234.50');
    expect(amount).toHaveClass('money');
    expect(amount).not.toHaveClass('money--strong');
  });

  it('can be emphasised', () => {
    render(<Money value={100} strong />);

    expect(screen.getByText('B$ 100.00')).toHaveClass('money', 'money--strong');
  });
});
