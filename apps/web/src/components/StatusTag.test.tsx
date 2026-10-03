import { render, screen } from '@testing-library/react';
import { StatusTag } from './StatusTag';

describe('StatusTag', () => {
  it('shows the humanised status with its colour', () => {
    render(<StatusTag status="PENDING_APPROVAL" />);

    const tag = screen.getByText('Pending approval');
    expect(tag).toHaveClass('status-tag');
    expect(tag).toHaveClass('ant-tag-orange');
  });

  it('prefers an explicit label', () => {
    render(<StatusTag status="ACTIVE" label="In force" />);

    expect(screen.getByText('In force')).toHaveClass('ant-tag-green');
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('uses the tone for chips that are not stored statuses', () => {
    render(<StatusTag tone="pending" label="Expires soon" wide />);

    const tag = screen.getByText('Expires soon');
    expect(tag).toHaveClass('ant-tag-orange');
    expect(tag).toHaveClass('status-tag--wide');
  });

  it('renders nothing without a status', () => {
    const { container } = render(<StatusTag status={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
