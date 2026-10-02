import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('shows the breadcrumb, title, status tags and key facts', () => {
    renderWithProviders(
      <PageHeader
        title="PRO/26/000001"
        tags={<span>Active</span>}
        breadcrumb={[{ title: 'Home', to: '/portal' }, { title: 'PRO/26/000001' }]}
        meta={[{ label: 'Product', value: 'Professional Takaful Plan' }, null, false]}
        extra={<button type="button">Renew</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'PRO/26/000001' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/portal');
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Professional Takaful Plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renew' })).toBeInTheDocument();
  });

  it('leaves out the facts row when there are none', () => {
    const { container } = renderWithProviders(<PageHeader title="Policies" meta={[null]} />);

    expect(container.querySelector('.page-header__meta')).toBeNull();
  });
});
