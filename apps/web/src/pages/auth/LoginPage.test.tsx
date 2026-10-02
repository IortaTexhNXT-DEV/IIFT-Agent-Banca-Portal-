import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { api, ApiError } from '../../api/client';
import { renderWithProviders, sessionUser } from '../../test-utils';
import LoginPage from './LoginPage';

vi.mock('../../api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/client')>()),
  api: { get: vi.fn(), post: vi.fn() },
}));

function renderLogin(route = '/login') {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/portal" element={<p>Portal dashboard</p>} />
      <Route path="/backoffice" element={<p>Back-office dashboard</p>} />
      <Route path="/change-password" element={<p>Change password</p>} />
    </Routes>,
    { route, withAuth: true },
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Not signed in'));
  });

  afterEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it('renders the username and password fields', () => {
    renderLogin();

    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('asks for both fields when submitted empty', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Enter your username')).toBeInTheDocument();
    expect(await screen.findByText('Enter your password')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('signs in with the typed credentials and opens the home page', async () => {
    vi.mocked(api.post).mockResolvedValue({
      user: sessionUser({ audience: 'BACKOFFICE', userType: 'STAFF' }),
      csrfToken: 'csrf',
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Username'), '  ops.admin ');
    await user.type(screen.getByLabelText('Password'), 'S3cret!pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Back-office dashboard')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      username: 'ops.admin',
      password: 'S3cret!pass',
    });
  });

  it('sends users who must change their password to the change-password page', async () => {
    vi.mocked(api.post).mockResolvedValue({
      user: sessionUser({ mustChangePassword: true }),
      csrfToken: 'csrf',
    });
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Username'), 'agent01');
    await user.type(screen.getByLabelText('Password'), 'Temp#1234');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Change password')).toBeInTheDocument();
  });

  it('shows the error returned for rejected credentials', async () => {
    vi.mocked(api.post).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid username or password'),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Username'), 'agent01');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
  });

  it('shows the product, release and vendor credit without marketing copy', () => {
    renderLogin();

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByText('SalesVerse 2.0')).toBeInTheDocument();
    expect(screen.getByText(/^v\d+\.\d+\.\d+/)).toBeInTheDocument();
    expect(screen.getByAltText('iorta TechNXT')).toBeInTheDocument();
  });

  it('explains that the previous session ended', () => {
    renderLogin('/login?expired=1');

    expect(screen.getByText('Your session ended. Please sign in again.')).toBeInTheDocument();
  });
});
