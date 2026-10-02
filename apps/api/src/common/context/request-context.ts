import { AsyncLocalStorage } from 'node:async_hooks';
import type { SessionUser } from '../security/session-user.js';

/**
 * Per-request context (who is acting, from where) made available to services
 * without passing it through every method signature. Populated by
 * RequestContextMiddleware; empty for scheduled jobs, which act as "system".
 */
export interface RequestContext {
  correlationId: string;
  user?: SessionUser;
  ipAddress?: string;
  userAgent?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(context: RequestContext, callback: () => T): T {
    return storage.run(context, callback);
  },

  current(): RequestContext | undefined {
    return storage.getStore();
  },

  /** Updates the user once the session has been established (e.g. right after login). */
  setUser(user: SessionUser | undefined): void {
    const context = storage.getStore();
    if (context) {
      context.user = user;
    }
  },
};

/** Actor columns for history records: the signed-in user, or "system" for jobs. */
export function currentActor(): { actorId: string | null; actorName: string } {
  const user = storage.getStore()?.user;
  return { actorId: user?.id ?? null, actorName: user?.fullName ?? 'System' };
}
