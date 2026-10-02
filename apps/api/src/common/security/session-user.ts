import type { PermissionCode } from './permissions.js';

export type AudienceCode = 'PORTAL' | 'BACKOFFICE';

/** Snapshot of the signed-in user kept in the server-side session. */
export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  userType: 'AGENT' | 'BANCA' | 'STAFF';
  audience: AudienceCode;
  permissions: PermissionCode[];
  agentId?: string;
  agencyId?: string;
  mustChangePassword: boolean;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
    csrfToken?: string;
    authenticatedAt?: number;
  }
}

export function hasPermission(user: SessionUser, permission: PermissionCode): boolean {
  return user.permissions.includes(permission);
}
