import { render, screen } from '@testing-library/react';
import { StatusTag } from './StatusTag';

describe('StatusTag', () => {
  it('shows the humanised status with its colour', () => {
    render(<StatusTag status="PENDING_APPROVAL" />);

    const tag = screen.getByText('Pending approval');
    expect(tag).toHaveClass('status-tag');
    expect(tag).toHaveClass('ant-tag-gold');
  });

  it('prefers an explicit label', () => {
    render(<StatusTag status="ACTIVE" label="In force" />);

    expect(screen.getByText('In force')).toHaveClass('ant-tag-green');
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders nothing without a status', () => {
    const { container } = render(<StatusTag status={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
