/**
 * Thin wrapper around fetch for the IIFT API.
 *
 * - Sends the session cookie (same origin) and the CSRF token on state-changing calls.
 * - Normalises error responses into ApiError, including the correlation id users can
 *   quote to support.
 */

const BASE = '/api/v1';

let csrfToken: string | undefined;

export function setCsrfToken(token: string | undefined): void {
  csrfToken = token;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: string[] = [],
    readonly correlationId?: string,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

/** Listeners notified when the session has ended (e.g. idle timeout) so the app can return to login. */
const sessionEndedListeners = new Set<() => void>();
export function onSessionEnded(listener: () => void): () => void {
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
}

function url(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return `${BASE}${path}${search ? `?${search}` : ''}`;
}

async function request<T>(method: string, path: string, options: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (method !== 'GET' && csrfToken) headers['x-csrf-token'] = csrfToken;
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url(path, options.query), { method, headers, body, credentials: 'same-origin' });
  if (response.status === 204) {
    return undefined as T;
  }
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = new ApiError(
      response.status,
      String(payload.code ?? 'REQUEST_FAILED'),
      String(payload.message ?? 'The request could not be completed'),
      Array.isArray(payload.details) ? (payload.details as string[]) : [],
      typeof payload.correlationId === 'string' ? payload.correlationId : undefined,
    );
    if (response.status === 401 && path !== '/auth/login') {
      sessionEndedListeners.forEach((listener) => listener());
    }
    throw error;
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body: body ?? {} }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { form }),
};

/** Downloads a file response (documents, exports) and saves it via the browser. */
export async function download(path: string, query?: Query): Promise<void> {
  const response = await fetch(url(path, query), { credentials: 'same-origin' });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new ApiError(response.status, payload.code ?? 'DOWNLOAD_FAILED', payload.message ?? 'Download failed');
  }
  const disposition = response.headers.get('content-disposition') ?? '';
  const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'download';
  const blob = await response.blob();
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}
