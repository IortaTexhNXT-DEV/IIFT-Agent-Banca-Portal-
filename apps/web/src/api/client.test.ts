import { api, ApiError, download, onSessionEnded, setCsrfToken } from './client';

const fetchMock = vi.fn<typeof fetch>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function lastRequest(): { url: string; init: RequestInit; headers: Record<string, string> } {
  const [url, init = {}] = fetchMock.mock.calls.at(-1)!;
  return { url: String(url), init, headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  setCsrfToken(undefined);
  vi.unstubAllGlobals();
});

describe('api requests', () => {
  it('prefixes the API base path, drops empty query parameters and returns the JSON body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));

    const result = await api.get('/portal/policies', {
      status: 'ACTIVE',
      page: 2,
      search: '',
      agencyId: null,
    });

    expect(result).toEqual({ items: [] });
    expect(lastRequest().url).toBe('/api/v1/portal/policies?status=ACTIVE&page=2');
    expect(lastRequest().init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('sends the CSRF token and a JSON body on state-changing requests', async () => {
    setCsrfToken('token-123');
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

    await api.post('/portal/policies', { productId: 'prod-1' });

    const { init, headers } = lastRequest();
    expect(init.method).toBe('POST');
    expect(headers['x-csrf-token']).toBe('token-123');
    expect(headers['content-type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ productId: 'prod-1' }));
  });

  it('does not send the CSRF token on GET requests', async () => {
    setCsrfToken('token-123');
    fetchMock.mockResolvedValue(jsonResponse({}));

    await api.get('/auth/me');

    expect(lastRequest().headers).not.toHaveProperty('x-csrf-token');
  });

  it('sends uploads as form data without a JSON content type', async () => {
    setCsrfToken('token-123');
    fetchMock.mockResolvedValue(jsonResponse({ id: 'doc-1' }));
    const form = new FormData();
    form.append('docType', 'NRIC');

    await api.upload('/documents', form);

    const { init, headers } = lastRequest();
    expect(init.body).toBe(form);
    expect(headers).not.toHaveProperty('content-type');
    expect(headers['x-csrf-token']).toBe('token-123');
  });

  it('resolves to undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.delete('/portal/policies/p1')).resolves.toBeUndefined();
  });
});

describe('api errors', () => {
  it('turns an error response into an ApiError with details and correlation id', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          code: 'VALIDATION_FAILED',
          message: 'Some fields are invalid',
          details: ['fullName is required'],
          correlationId: 'corr-1',
        },
        400,
      ),
    );

    const error = await api.post('/portal/participants', {}).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'Some fields are invalid',
      details: ['fullName is required'],
      correlationId: 'corr-1',
    });
  });

  it('uses a generic error when the response body is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('Bad gateway', { status: 502 }));

    const error = await api.get('/portal/policies').catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      status: 502,
      code: 'REQUEST_FAILED',
      message: 'The request could not be completed',
      details: [],
      correlationId: undefined,
    });
  });

  it('notifies session-ended listeners on 401', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionEnded(listener);
    fetchMock.mockResolvedValue(jsonResponse({ code: 'UNAUTHENTICATED', message: 'Expired' }, 401));

    await expect(api.get('/portal/policies')).rejects.toBeInstanceOf(ApiError);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('does not end the session when the login itself is rejected', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionEnded(listener);
    fetchMock.mockResolvedValue(jsonResponse({ code: 'INVALID_CREDENTIALS' }, 401));

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ status: 401 });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('stops notifying a listener after it unsubscribes', async () => {
    const listener = vi.fn();
    onSessionEnded(listener)();
    fetchMock.mockResolvedValue(jsonResponse({}, 401));

    await expect(api.get('/portal/policies')).rejects.toBeInstanceOf(ApiError);

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not end the session on other client errors', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionEnded(listener);
    fetchMock.mockResolvedValue(jsonResponse({ code: 'FORBIDDEN' }, 403));

    await expect(api.get('/backoffice/users')).rejects.toMatchObject({ status: 403 });

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

describe('download', () => {
  it('raises an ApiError when the file cannot be downloaded', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ code: 'NOT_FOUND', message: 'No such file' }, 404));

    await expect(download('/documents/missing')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'No such file',
    });
  });
});
