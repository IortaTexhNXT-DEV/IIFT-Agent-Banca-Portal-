/**
 * Repeatable application security checks for SalesVerse 2.0 (OWASP Top 10 2021).
 * Run against a NON-PRODUCTION environment loaded with the demonstration data:
 *
 *   BASE_URL=http://localhost:3000 DEMO_PASSWORD='...' [INBOUND_API_KEY='...'] \
 *     node tools/security/security-checks.mjs > results.json
 *
 * Each check records what was sent, what was expected and what came back. The script
 * changes data (it signs in, fails logins on purpose, attempts uploads) so it must not
 * be pointed at production.
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD;
/** Optional: the environment's inbound key, to confirm a valid key is accepted. */
const INBOUND_API_KEY = process.env.INBOUND_API_KEY;
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD');
  process.exit(2);
}

const results = [];
/** Clients signed in once and reused, keeping the run under the sign-in rate limit. */
const sharedClients = {};
function record(id, owasp, title, passed, evidence) {
  results.push({ id, owasp, title, result: passed ? 'PASS' : 'FAIL', evidence });
}

class Client {
  cookie = '';
  csrf = '';

  async request(method, path, { body, headers = {}, form, raw } = {}) {
    const init = { method, headers: { ...headers }, redirect: 'manual' };
    if (this.cookie) init.headers.cookie = this.cookie;
    if (method !== 'GET' && this.csrf && !('x-csrf-token' in headers)) init.headers['x-csrf-token'] = this.csrf;
    if (form) init.body = form;
    else if (raw !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = raw;
    } else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const response = await fetch(`${BASE}${path}`, init);
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, headers: response.headers, json, text, setCookie };
  }

  async login(username, password = PASSWORD) {
    const response = await this.request('POST', '/api/v1/auth/login', { body: { username, password } });
    this.csrf = response.json?.csrfToken ?? '';
    return response;
  }
}

const pdf = () => new Blob([Buffer.from('%PDF-1.4\n%%EOF\n')], { type: 'application/pdf' });
const leaks = (text) => /(\bat \/|node_modules|prisma|stack|SELECT |postgres)/i.test(text);

// ---------------------------------------------------------------------------
// A05 Security misconfiguration
// ---------------------------------------------------------------------------
{
  const anonymous = new Client();
  const response = await anonymous.request('GET', '/health/live');
  const h = response.headers;
  record('SEC-01', 'A05', 'Security headers on API responses', !!h.get('strict-transport-security') && h.get('x-content-type-options') === 'nosniff' && !!h.get('content-security-policy') && !!h.get('x-frame-options') && !h.get('x-powered-by'), {
    'strict-transport-security': h.get('strict-transport-security'),
    'x-content-type-options': h.get('x-content-type-options'),
    'x-frame-options': h.get('x-frame-options'),
    'content-security-policy': h.get('content-security-policy'),
    'x-powered-by': h.get('x-powered-by'),
  });

  const unknown = await anonymous.request('GET', '/api/v1/does-not-exist');
  record('SEC-02', 'A05', 'Unknown routes return a generic JSON error without framework details', unknown.status === 401 || unknown.status === 404, { status: unknown.status, body: unknown.json });

  const malformed = await anonymous.request('POST', '/api/v1/auth/login', { raw: '{"username": "x", "password": ' });
  record('SEC-03', 'A05', 'Malformed JSON is rejected without a stack trace', malformed.status === 400 && !leaks(malformed.text), { status: malformed.status, body: malformed.json });
}

// ---------------------------------------------------------------------------
// A07 Identification and authentication failures
// ---------------------------------------------------------------------------
{
  const a = new Client();
  const unknownUser = await a.request('POST', '/api/v1/auth/login', { body: { username: 'no-such-user', password: 'x' } });
  const wrongPassword = await a.request('POST', '/api/v1/auth/login', { body: { username: 'compliance', password: 'wrong-password' } });
  record('SEC-04', 'A07', 'Same response for unknown user and wrong password (no user enumeration)', unknownUser.status === 401 && unknownUser.json?.message === wrongPassword.json?.message, {
    unknownUser: unknownUser.json?.message,
    wrongPassword: wrongPassword.json?.message,
  });

  const injectedLogin = await new Client().request('POST', '/api/v1/auth/login', { body: { username: "admin' OR '1'='1", password: "' OR '1'='1" } });
  record('SEC-18', 'A03', 'Injection in sign-in fields is rejected as invalid credentials', injectedLogin.status === 401, { status: injectedLogin.status });

  const ldap = await new Client().request('POST', '/api/v1/auth/login', { body: { username: '*)(uid=*))(|(uid=*', password: 'x' } });
  record('SEC-19', 'A03', 'LDAP filter characters in usernames do not alter directory queries', ldap.status === 401, { status: ldap.status });

  const otherAgencyClient = new Client();
  const login = await otherAgencyClient.login('ag-000003');
  const cookie = login.setCookie ?? '';
  record('SEC-05', 'A07', 'Session cookie is HttpOnly and SameSite=Strict (Secure is enforced in production configuration)', /HttpOnly/i.test(cookie) && /SameSite=Strict/i.test(cookie), { setCookie: cookie.replace(/=[^;]+/, '=<redacted>') });

  const firstId = otherAgencyClient.cookie;
  await otherAgencyClient.login('ag-000003');
  record('SEC-06', 'A07', 'Session identifier changes at every sign-in (no session fixation)', firstId !== otherAgencyClient.cookie, { changed: firstId !== otherAgencyClient.cookie });
  sharedClients.otherAgency = otherAgencyClient;

  const logout = new Client();
  await logout.login('ag-000002');
  const stolenCookie = logout.cookie;
  await logout.request('POST', '/api/v1/auth/logout');
  const replay = new Client();
  replay.cookie = stolenCookie;
  const afterLogout = await replay.request('GET', '/api/v1/auth/me');
  record('SEC-07', 'A07', 'A session cookie cannot be reused after logout (server-side revocation)', afterLogout.status === 401, { status: afterLogout.status });

}

// ---------------------------------------------------------------------------
// A01 Broken access control
// ---------------------------------------------------------------------------
const mainAgent = new Client();
await mainAgent.login('ag-000001');
const otherAgency = sharedClients.otherAgency;
const staff = new Client();
await staff.login('manager');
{
  const anonymous = new Client();
  const anon = await anonymous.request('GET', '/api/v1/portal/policies');
  record('SEC-09', 'A01', 'Protected endpoints require a session', anon.status === 401, { status: anon.status });

  const crossAudience = await mainAgent.request('GET', '/api/v1/backoffice/users');
  record('SEC-10', 'A01', 'Portal users cannot call back-office APIs', crossAudience.status === 403, { status: crossAudience.status, code: crossAudience.json?.code });

  const policies = await mainAgent.request('GET', '/api/v1/portal/policies?status=ACTIVE&pageSize=1');
  const policyId = policies.json?.items?.[0]?.id;
  const idor = await otherAgency.request('GET', `/api/v1/portal/policies/${policyId}`);
  record('SEC-11', 'A01', "Another agency's policy cannot be read by changing the identifier (IDOR)", idor.status === 404, { status: idor.status });

  const detail = await mainAgent.request('GET', `/api/v1/portal/policies/${policyId}`);
  const documentId = detail.json?.documents?.[0]?.id;
  const docIdor = await otherAgency.request('GET', `/api/v1/common/documents/${documentId}/content`);
  record('SEC-12', 'A01', "Another agency's documents cannot be downloaded", docIdor.status === 403 || docIdor.status === 404, { status: docIdor.status });

  const participants = await mainAgent.request('GET', '/api/v1/portal/participants?pageSize=50');
  const own = participants.json?.items?.find((p) => p.fullName);
  const participantIdor = await otherAgency.request('GET', `/api/v1/portal/participants/${own?.id}`);
  record('SEC-13', 'A01', 'Participant profiles are limited to agencies that hold business with them', [403, 404].includes(participantIdor.status), { status: participantIdor.status });

  const opsMaker = new Client();
  await opsMaker.login('ops.maker');
  const escalation = await opsMaker.request('POST', '/api/v1/backoffice/roles', { body: { code: 'ROGUE_ROLE', name: 'Rogue', audience: 'BACKOFFICE', permissions: ['bo.users.manage'] } });
  record('SEC-14', 'A01', 'Users cannot grant themselves permissions they do not hold', escalation.status === 403, { status: escalation.status });

  const csrfMissing = await mainAgent.request('POST', '/api/v1/common/notifications/read-all', { headers: { 'x-csrf-token': '' } });
  const csrfForeign = await mainAgent.request('POST', '/api/v1/common/notifications/read-all', { headers: { 'x-csrf-token': otherAgency.csrf } });
  record('SEC-15', 'A01', 'State-changing requests require the session’s own CSRF token', csrfMissing.status === 403 && csrfForeign.status === 403, { missing: csrfMissing.status, otherSessionsToken: csrfForeign.status });
}

// ---------------------------------------------------------------------------
// A03 Injection
// ---------------------------------------------------------------------------
{
  const payloads = ["' OR '1'='1", "'; DROP TABLE policy; --", '1 UNION SELECT password_hash FROM app_user', "\\' OR 1=1 --", '%27%20OR%201%3D1', '${7*7}', '<script>alert(1)</script>', "admin'--", '{"$gt": ""}', 'SLEEP(5)'];
  const outcomes = [];
  for (const payload of payloads) {
    const started = Date.now();
    const response = await mainAgent.request('GET', `/api/v1/portal/policies?search=${encodeURIComponent(payload)}`);
    outcomes.push({ payload, status: response.status, items: response.json?.items?.length, ms: Date.now() - started, leaked: leaks(response.text) });
  }
  record('SEC-17', 'A03', 'SQL/NoSQL/template injection payloads in search are treated as text', outcomes.every((o) => o.status === 200 && o.items === 0 && !o.leaked && o.ms < 3000), outcomes);
}

// ---------------------------------------------------------------------------
// A04 Insecure design / business-logic abuse
// ---------------------------------------------------------------------------
{
  const outstanding = await mainAgent.request('GET', '/api/v1/portal/billing/outstanding');
  const target = outstanding.json?.policies?.find((p) => p.paymentStatus === 'UNPAID') ?? outstanding.json?.policies?.[0];
  const form = (amount, date) => {
    const data = new FormData();
    data.set('method', 'BANK_TRANSFER');
    data.set('referenceNo', 'SEC-TEST-01');
    data.set('paymentDate', date);
    data.set('allocations', JSON.stringify([{ policyId: target?.id ?? '00000000-0000-0000-0000-000000000000', amount }]));
    data.set('proof', pdf(), 'proof.pdf');
    return data;
  };
  const negative = await mainAgent.request('POST', '/api/v1/portal/billing/payments', { form: form(-50, '2026-01-01') });
  const future = await mainAgent.request('POST', '/api/v1/portal/billing/payments', { form: form(1, '2099-01-01') });
  const excessive = await mainAgent.request('POST', '/api/v1/portal/billing/payments', { form: form(999999, '2026-01-01') });
  record('SEC-20', 'A04', 'Negative, future-dated and excessive payments are refused', [negative, future, excessive].every((r) => r.status === 400 || r.status === 422), {
    negative: negative.status,
    futureDate: future.status,
    aboveOutstanding: excessive.status,
  });

  const massAssignment = await mainAgent.request('POST', '/api/v1/portal/participants', {
    body: { type: 'INDIVIDUAL', fullName: 'Mass Assign', idType: 'NRIC', idNumber: '01-777001', dateOfBirth: '1990-01-01', mobile: '6738000000', addressLine1: 'Street 1', amlStatus: 'CLEAR', createdByAgencyId: 'x' },
  });
  record('SEC-21', 'A04', 'Unexpected fields (mass assignment) are rejected', massAssignment.status === 400, { status: massAssignment.status, details: massAssignment.json?.details });
}

// ---------------------------------------------------------------------------
// A08 Software and data integrity: file uploads
// ---------------------------------------------------------------------------
{
  const policies = await mainAgent.request('GET', '/api/v1/portal/policies?status=DRAFT&pageSize=1');
  const ownerId = policies.json?.items?.[0]?.id;
  const upload = async (bytes, name, type) => {
    const data = new FormData();
    data.set('ownerType', 'POLICY');
    data.set('ownerId', ownerId);
    data.set('docType', 'OTHER');
    data.set('file', new Blob([bytes], { type }), name);
    return mainAgent.request('POST', '/api/v1/common/documents', { form: data });
  };
  const exe = await upload(Buffer.from('MZ\x90\x00\x03'), 'invoice.pdf', 'application/pdf');
  const html = await upload(Buffer.from('<html><script>alert(1)</script></html>'), 'proof.png', 'image/png');
  const svg = await upload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'logo.svg', 'image/svg+xml');
  const big = await upload(Buffer.concat([Buffer.from('%PDF-'), Buffer.alloc(11 * 1024 * 1024)]), 'big.pdf', 'application/pdf');
  const traversal = await upload(Buffer.from('%PDF-1.4\n%%EOF'), '../../../etc/passwd.pdf', 'application/pdf');
  record('SEC-22', 'A08', 'Uploads are checked by content: executables, HTML and SVG are refused', [exe, html, svg].every((r) => r.status === 422), { exe: exe.status, html: html.status, svg: svg.status });
  record('SEC-23', 'A08', 'Uploads above the size limit are refused', big.status === 422 || big.status === 413, { status: big.status, code: big.json?.code });
  record('SEC-24', 'A08', 'Path elements in file names are removed', traversal.status === 201 && !traversal.json?.fileName?.includes('..') && !traversal.json?.fileName?.includes('/'), { status: traversal.status, storedName: traversal.json?.fileName });
}

// ---------------------------------------------------------------------------
// A02 Cryptographic failures / sensitive data exposure
// ---------------------------------------------------------------------------
{
  const participants = await mainAgent.request('GET', '/api/v1/portal/participants?pageSize=5');
  const items = participants.json?.items ?? [];
  record('SEC-25', 'A02', 'Identification numbers are returned masked; ciphertext and hashes are never returned', items.length > 0 && items.every((p) => /^\*+.{4}$/.test(p.idNumberMasked) && !('idNumberEnc' in p) && !('idNumberHash' in p)), items.map((p) => p.idNumberMasked));

  const users = await staff.request('GET', '/api/v1/backoffice/users?pageSize=5');
  record('SEC-26', 'A02', 'Password hashes are never returned by the API', users.status === 200 && !/password_?hash|\$argon2/i.test(users.text), { status: users.status });
}

// ---------------------------------------------------------------------------
// A09 Logging and monitoring
// ---------------------------------------------------------------------------
{
  const audit = await staff.request('GET', '/api/v1/backoffice/audit?action=LOGIN_FAILED&pageSize=5');
  record('SEC-27', 'A09', 'Failed sign-ins are recorded in the audit trail with IP address', audit.status === 200 && audit.json.total > 0 && !!audit.json.items[0].ipAddress, { total: audit.json?.total, sample: audit.json?.items?.[0] && { action: audit.json.items[0].action, ip: audit.json.items[0].ipAddress, at: audit.json.items[0].occurredAt } });

  const response = await new Client().request('GET', '/health/live');
  record('SEC-28', 'A09', 'Every response carries a correlation id for tracing', !!response.headers.get('x-request-id'), { 'x-request-id': response.headers.get('x-request-id') });
}

// ---------------------------------------------------------------------------
// A10 / public endpoints
// ---------------------------------------------------------------------------
{
  const anonymous = new Client();
  const badToken = await anonymous.request('GET', '/api/v1/public/esign/not-a-token');
  const guessed = await anonymous.request('GET', `/api/v1/public/esign/${'A'.repeat(43)}`);
  record('SEC-29', 'A01', 'E-signature links cannot be guessed; invalid tokens reveal nothing', [404, 422].includes(badToken.status) && [404, 422].includes(guessed.status) && !leaks(guessed.text), { malformed: badToken.status, wellFormedButUnknown: guessed.status });

  const path = '/api/v1/integration/policies?issuedOn=2026-01-01';
  const missing = await anonymous.request('GET', path);
  const wrong = await anonymous.request('GET', path, { headers: { 'x-api-key': 'not-the-key' } });
  const evidence = { withoutKey: missing.status, wrongKey: wrong.status };
  let passed = [401, 503].includes(missing.status) && [401, 503].includes(wrong.status);
  if (INBOUND_API_KEY) {
    const valid = await anonymous.request('GET', path, { headers: { 'x-api-key': INBOUND_API_KEY } });
    evidence.validKey = valid.status;
    passed &&= valid.status === 200;
  }
  record('SEC-30', 'A07', 'System-to-system APIs require a valid API key', passed, evidence);
}

// Runs last: it deliberately exhausts the sign-in rate limit for this client address.
{
  const attacker = new Client();
  const statuses = [];
  for (let i = 0; i < 12; i++) {
    statuses.push((await attacker.request('POST', '/api/v1/auth/login', { body: { username: `brute-${i}`, password: 'guess' } })).status);
  }
  record('SEC-08', 'A07', 'Sign-in attempts are rate limited per client (HTTP 429)', statuses.includes(429), { statuses });
}

const summary = { baseUrl: BASE, runAt: new Date().toISOString(), total: results.length, passed: results.filter((r) => r.result === 'PASS').length };
process.stdout.write(`${JSON.stringify({ summary, results }, null, 2)}\n`);
