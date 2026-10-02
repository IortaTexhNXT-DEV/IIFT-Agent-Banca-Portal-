import { render, screen } from '@testing-library/react';
import { ApiError } from '../api/client';
import { ErrorAlert } from './ErrorAlert';

describe('ErrorAlert', () => {
  it('renders nothing when there is no error', () => {
    const { container } = render(<ErrorAlert error={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the API message and each validation detail', () => {
    const error = new ApiError(400, 'VALIDATION_FAILED', 'Check the highlighted fields', [
      'Full name is required',
      'Date of birth is invalid',
    ]);
    render(<ErrorAlert error={error} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Check the highlighted fields');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Full name is required',
      'Date of birth is invalid',
    ]);
  });

  it('shows the support reference for server errors only', () => {
    const { rerender } = render(
      <ErrorAlert error={new ApiError(500, 'INTERNAL', 'Server error', [], 'corr-500')} />,
    );
    expect(screen.getByText('Reference: corr-500')).toBeInTheDocument();

    rerender(<ErrorAlert error={new ApiError(409, 'CONFLICT', 'Changed', [], 'corr-409')} />);
    expect(screen.queryByText(/Reference:/)).not.toBeInTheDocument();
  });

  it('falls back to a generic message for unexpected errors', () => {
    render(<ErrorAlert error={new TypeError('Failed to fetch')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  });
});
