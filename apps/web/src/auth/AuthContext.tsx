import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { api, onSessionEnded, setCsrfToken } from '../api/client';
import type { AuthResponse, SessionUser } from '../api/types';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<SessionUser>;
  logout(): Promise<void>;
  refresh(response: AuthResponse): void;
  can(permission: string): boolean;
}

const AuthContext = createContext<AuthState | null>(null);
const ME_KEY = ['auth', 'me'];

async function fetchMe(): Promise<SessionUser | null> {
  try {
    const response = await api.get<AuthResponse>('/auth/me');
    setCsrfToken(response.csrfToken);
    return response.user;
  } catch {
    setCsrfToken(undefined);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data: user = null, isLoading } = useQuery({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: Infinity,
    retry: false,
  });

  const refresh = useCallback(
    (response: AuthResponse) => {
      setCsrfToken(response.csrfToken);
      queryClient.setQueryData(ME_KEY, response.user);
    },
    [queryClient],
  );

  const clear = useCallback(() => {
    setCsrfToken(undefined);
    queryClient.clear();
    queryClient.setQueryData(ME_KEY, null);
  }, [queryClient]);

  useEffect(() => onSessionEnded(clear), [clear]);

  /** The local session is cleared even when the server call fails. */
  const logout = useCallback(async () => {
    await api.post('/auth/logout').finally(clear);
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading: isLoading,
      async login(username, password) {
        const response = await api.post<AuthResponse>('/auth/login', { username, password });
        // Drop what was cached for the previous user, but never remove the session query
        // itself: the provider's subscription would be left on a dead entry.
        queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== ME_KEY[0] });
        refresh(response);
        return response.user;
      },
      logout,
      refresh,
      can: (permission) => user?.permissions.includes(permission) ?? false,
    }),
    [user, isLoading, queryClient, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Home route for the signed-in user's audience. */
export function homePath(user: SessionUser): string {
  return user.audience === 'BACKOFFICE' ? '/backoffice' : '/portal';
}
