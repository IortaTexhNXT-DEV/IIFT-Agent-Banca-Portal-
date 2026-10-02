import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { App as AntApp, ConfigProvider } from 'antd';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import type { SessionUser } from './api/types';
import { AuthProvider } from './auth/AuthContext';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

interface ProviderOptions {
  /** Initial URL of the in-memory router. */
  route?: string;
  /** Wraps the tree in the real AuthProvider (the API client must be mocked). */
  withAuth?: boolean;
  queryClient?: QueryClient;
}

export function createWrapper({
  route = '/',
  withAuth = false,
  queryClient = createTestQueryClient(),
}: ProviderOptions = {}) {
  return function Providers({ children }: { children: ReactNode }) {
    return (
      <ConfigProvider>
        <AntApp>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[route]}>
              {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
            </MemoryRouter>
          </QueryClientProvider>
        </AntApp>
      </ConfigProvider>
    );
  };
}

export function renderWithProviders(
  ui: ReactElement,
  options: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { route, withAuth, queryClient = createTestQueryClient(), ...renderOptions } = options;
  return {
    queryClient,
    ...render(ui, {
      wrapper: createWrapper({ route, withAuth, queryClient }),
      ...renderOptions,
    }),
  };
}

export function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    username: 'agent01',
    fullName: 'Nur Aisyah',
    email: 'agent01@example.com',
    userType: 'AGENT',
    audience: 'PORTAL',
    permissions: [],
    mustChangePassword: false,
    ...overrides,
  };
}
