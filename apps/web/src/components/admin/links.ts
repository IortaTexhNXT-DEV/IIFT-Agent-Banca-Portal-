import type { Audience } from '../../api/types';

/**
 * Route segment of each record type, keyed by the lower-cased entity type. The API
 * uses both "Policy" (approvals, audit) and "POLICY" (document owners) spellings.
 */
const RECORD_ROUTES: Record<Audience, Record<string, string>> = {
  BACKOFFICE: {
    policy: 'policies',
    participant: 'participants',
    agent: 'agents',
    agency: 'agencies',
    payment: 'payments',
    claim: 'claims',
    issue: 'issues',
  },
  PORTAL: {
    policy: 'policies',
    participant: 'participants',
    agent: 'team',
    payment: 'billing/payments',
    claim: 'claims',
    issue: 'issues',
  },
};

export function basePathFor(audience: Audience): '/portal' | '/backoffice' {
  return audience === 'BACKOFFICE' ? '/backoffice' : '/portal';
}

/** Screen showing a record, or null when the audience has no page for that type. */
export function recordPath(audience: Audience, entityType: string | null | undefined, id: string | null | undefined): string | null {
  const segment = entityType ? RECORD_ROUTES[audience][entityType.toLowerCase()] : undefined;
  return segment && id ? `${basePathFor(audience)}/${segment}/${id}` : null;
}

/** Notification links are either absolute app paths or audience-neutral ("/issues/x"). */
export function notificationPath(audience: Audience, link: string): string {
  if (link.startsWith('/portal') || link.startsWith('/backoffice')) return link;
  return `${basePathFor(audience)}${link.startsWith('/') ? '' : '/'}${link}`;
}
