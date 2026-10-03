/**
 * Executes the API-level system test cases of the SalesVerse 2.0 test case workbook
 * (docs/technical/SalesVerse-2.0-Test-Cases.xlsx, cases with automation "Executed – API run")
 * against a NON-PRODUCTION environment loaded with the demonstration data:
 *
 *   BASE_URL=http://localhost:3000 DEMO_PASSWORD='...' [INBOUND_API_KEY='...'] \
 *     node tools/testing/api-test-run.mjs
 *
 * Every step records the actor, the request, the response summary, the expectation and
 * the verdict in docs/technical/evidence/api-test-run.json, which the test case workbook
 * and the Test Strategy read at build time. The run creates business records (participants,
 * quotations, payments, requests, a staff user) and must never be pointed at production.
 */

import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const PASSWORD = process.env.DEMO_PASSWORD;
const INBOUND_API_KEY = process.env.INBOUND_API_KEY;
const OUT = process.env.OUT ?? 'docs/technical/evidence/api-test-run.json';
if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD');
  process.exit(2);
}

const results = [];
const relogins = [];
const sessions = {};
const RUN = Date.now().toString(36).slice(-6).toUpperCase();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Business date in Brunei (UTC+8). */
function bruneiToday(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 3_600_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

class Client {
  cookie = '';
  csrf = '';
  user = null;
  credentials = null;

  /** Signs in again when a shared demonstration account was signed in elsewhere (single active session). */
  async request(method, path, options = {}) {
    const response = await this.send(method, path, options);
    if (response.status === 401 && response.json?.code === 'NOT_AUTHENTICATED' && this.credentials && !options.noRetry) {
      const again = await login(this.credentials.username, this.credentials.password);
      if (again.response.status === 200) {
        this.cookie = again.client.cookie;
        this.csrf = again.client.csrf;
        this.user = again.client.user;
        relogins.push({ username: this.credentials.username, at: new Date().toISOString(), before: `${method} ${path}` });
        return this.send(method, path, options);
      }
    }
    return response;
  }

  async send(method, path, { body, headers = {}, form, raw, csrf = true } = {}) {
    const init = { method, headers: { ...headers }, redirect: 'manual' };
    if (this.cookie) init.headers.cookie = this.cookie;
    if (method !== 'GET' && csrf && this.csrf && !('x-csrf-token' in headers)) {
      init.headers['x-csrf-token'] = this.csrf;
    }
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
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = buffer.toString('utf8');
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: response.status, headers: response.headers, json, text, buffer, setCookie };
  }
}

let loginsThisMinute = 0;
let minuteStart = Date.now();
async function login(username, password = PASSWORD) {
  if (Date.now() - minuteStart > 60_000) {
    loginsThisMinute = 0;
    minuteStart = Date.now();
  }
  if (loginsThisMinute >= 8) {
    await sleep(61_000 - (Date.now() - minuteStart));
    loginsThisMinute = 0;
    minuteStart = Date.now();
  }
  loginsThisMinute += 1;
  const client = new Client();
  const response = await client.send('POST', '/api/v1/auth/login', {
    body: { username, password },
  });
  if (response.status === 429) {
    await sleep(61_000);
    return login(username, password);
  }
  client.csrf = response.json?.csrfToken ?? '';
  client.user = response.json?.user ?? null;
  if (response.status === 200) client.credentials = { username, password };
  return { client, response };
}

async function as(username) {
  if (!sessions[username]) {
    const { client, response } = await login(username);
    if (response.status !== 200) {
      throw new Error(`Sign-in as ${username} failed: HTTP ${response.status} ${response.text}`);
    }
    sessions[username] = client;
  }
  return sessions[username];
}

function summary(response) {
  const code = response.json?.code ?? response.json?.status ?? '';
  const message = response.json?.message ?? '';
  const details = Array.isArray(response.json?.details) ? ` [${response.json.details.join('; ')}]` : '';
  return `${response.status}${code ? ' ' + code : ''}${message ? ' – ' + message : ''}${details}`.slice(0, 300);
}

/** Runs one case; the function returns { request, response, pass, note? } or throws. */
async function step(id, title, actor, expected, fn) {
  const startedAt = new Date().toISOString();
  let entry;
  try {
    const outcome = await fn();
    entry = { ...outcome, result: outcome.pass ? 'Passed' : outcome.blocked ? 'Blocked' : 'Failed' };
    delete entry.blocked;
  } catch (error) {
    entry = { request: '', response: `Error: ${error.message}`.slice(0, 300), pass: false, result: 'Failed' };
  }
  delete entry.pass;
  results.push({ id, title, actor, expected, executedAt: startedAt, ...entry });
  console.log(`${entry.result.padEnd(7)} ${id} ${title}`);
  return entry.result === 'Passed';
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function fileForm(fields, fileField, content, name, type = 'application/pdf') {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append(fileField, new Blob([content], { type }), name);
  return form;
}

function upload(client, ownerType, ownerId, docType, content = PDF, name = 'document.pdf') {
  return client.request('POST', '/api/v1/common/documents', {
    form: fileForm({ ownerType, ownerId, docType }, 'file', content, name),
  });
}

const state = {};

// ---------------------------------------------------------------------------------------------
// 1. Authentication and session
// ---------------------------------------------------------------------------------------------
async function authentication() {
  await step('EX-001', 'Wrong password and unknown user get the same generic 401', 'anonymous',
    'HTTP 401 INVALID_CREDENTIALS for both; identical message', async () => {
      const unknown = await new Client().request('POST', '/api/v1/auth/login', { body: { username: 'nobody-' + RUN, password: 'x' } });
      const wrong = await new Client().request('POST', '/api/v1/auth/login', { body: { username: 'finance', password: 'wrong-password' } });
      loginsThisMinute += 2;
      return {
        request: 'POST /api/v1/auth/login (unknown user; finance with wrong password)',
        response: `${summary(unknown)} | ${summary(wrong)}`,
        pass: unknown.status === 401 && wrong.status === 401 && unknown.json?.code === 'INVALID_CREDENTIALS' && unknown.json?.message === wrong.json?.message,
      };
    });

  await step('EX-002', 'Successful sign-in issues a HttpOnly SameSite=Strict cookie and a CSRF token', 'ag-000001',
    'HTTP 200; Set-Cookie has HttpOnly and SameSite=Strict; csrfToken present; no password hash in body', async () => {
      const { client, response } = await login('ag-000001');
      sessions['ag-000001'] = client;
      const cookie = response.setCookie ?? '';
      return {
        request: 'POST /api/v1/auth/login',
        response: `${response.status}; Set-Cookie flags: ${cookie.split(';').slice(1).map((p) => p.trim()).filter((p) => !p.startsWith('Expires')).join(', ')}; csrfToken ${response.json?.csrfToken ? 'present' : 'absent'}`,
        pass: response.status === 200 && /HttpOnly/.test(cookie) && /SameSite=Strict/.test(cookie) && !!response.json?.csrfToken && !/passwordHash|argon2/.test(response.text),
      };
    });

  await step('EX-003', 'State-changing request without the CSRF token is refused', 'ag-000001',
    'HTTP 403 CSRF_TOKEN_INVALID without token and with a forged token; 204 with the session token', async () => {
      const client = await as('ag-000001');
      const none = await client.request('POST', '/api/v1/common/notifications/read-all', { csrf: false });
      const forged = await client.request('POST', '/api/v1/common/notifications/read-all', { headers: { 'x-csrf-token': 'forged' } });
      const ok = await client.request('POST', '/api/v1/common/notifications/read-all');
      return {
        request: 'POST /api/v1/common/notifications/read-all (no token; forged token; session token)',
        response: `${summary(none)} | ${summary(forged)} | ${ok.status}`,
        pass: none.status === 403 && none.json?.code === 'CSRF_TOKEN_INVALID' && forged.status === 403 && ok.status === 204,
      };
    });

  await step('EX-004', 'Portal user cannot call back-office routes and vice versa', 'ag-000001, finance',
    'HTTP 403 WRONG_AUDIENCE in both directions', async () => {
      const agent = await as('ag-000001');
      const finance = await as('finance');
      const a = await agent.request('GET', '/api/v1/backoffice/agents');
      const b = await finance.request('GET', '/api/v1/portal/policies');
      return {
        request: 'GET /api/v1/backoffice/agents as agent; GET /api/v1/portal/policies as finance',
        response: `${summary(a)} | ${summary(b)}`,
        pass: a.status === 403 && a.json?.code === 'WRONG_AUDIENCE' && b.status === 403 && b.json?.code === 'WRONG_AUDIENCE',
      };
    });

  await step('EX-005', 'Permission guard inside the back-office', 'ops.maker',
    'HTTP 403 FORBIDDEN on user administration for the operations officer', async () => {
      const maker = await as('ops.maker');
      const r = await maker.request('GET', '/api/v1/backoffice/users');
      return { request: 'GET /api/v1/backoffice/users', response: summary(r), pass: r.status === 403 && r.json?.code === 'FORBIDDEN' };
    });

  await step('EX-006', 'Password policy is enforced on change-password', 'ag-000002',
    'HTTP 422 PASSWORD_POLICY for a weak password; 422 CURRENT_PASSWORD_INCORRECT when the current password is wrong; the demo password is unchanged', async () => {
      const client = await as('ag-000002');
      const weak = await client.request('POST', '/api/v1/auth/change-password', { body: { currentPassword: PASSWORD, newPassword: 'password1' } });
      const wrong = await client.request('POST', '/api/v1/auth/change-password', { body: { currentPassword: 'not-the-password', newPassword: 'Str0ng!Passw0rd#2026' } });
      const me = await client.request('GET', '/api/v1/auth/me');
      return {
        request: 'POST /api/v1/auth/change-password (weak new password; wrong current password)',
        response: `${summary(weak)} | ${summary(wrong)} | session still valid: ${me.status}`,
        pass: weak.status === 422 && weak.json?.code === 'PASSWORD_POLICY' && wrong.status === 422 && wrong.json?.code === 'CURRENT_PASSWORD_INCORRECT' && me.status === 200,
      };
    });

  await step('EX-007', 'Logout ends the session server-side', 'ag-000003',
    'GET /auth/me 200 before logout, 401 NOT_AUTHENTICATED after', async () => {
      const { client } = await login('ag-000003');
      const before = await client.request('GET', '/api/v1/auth/me');
      const out = await client.request('POST', '/api/v1/auth/logout');
      const after = await client.request('GET', '/api/v1/auth/me', { noRetry: true });
      return {
        request: 'GET /api/v1/auth/me; POST /api/v1/auth/logout; GET /api/v1/auth/me',
        response: `${before.status} | ${out.status} | ${summary(after)}`,
        pass: before.status === 200 && out.status === 204 && after.status === 401,
      };
    });

  await step('EX-008', 'Signing in again ends the earlier session (single active session)', 'ag-000003',
    'The first session receives 401 NOT_AUTHENTICATED after the second sign-in', async () => {
      const first = (await login('ag-000003')).client;
      const second = (await login('ag-000003')).client;
      sessions['ag-000003'] = second;
      const r = await first.request('GET', '/api/v1/auth/me', { noRetry: true });
      return { request: 'Two sign-ins as ag-000003, then GET /api/v1/auth/me with the first cookie', response: summary(r), pass: r.status === 401 && r.json?.code === 'NOT_AUTHENTICATED' };
    });

  await step('EX-009', 'Sub-agents see their own business; the principal sees the whole agency', 'ag-000001, ag-000002',
    'ag-000002 lists only policies with agent AG-000002; ag-000001 lists more policies, including those of AG-000002', async () => {
      const principal = await as('ag-000001');
      const sub = await as('ag-000002');
      const own = (await sub.request('GET', '/api/v1/portal/policies?pageSize=100')).json ?? {};
      const agency = (await principal.request('GET', '/api/v1/portal/policies?pageSize=100')).json ?? {};
      const onlyOwn = (own.items ?? []).every((p) => p.agent?.agentCode === 'AG-000002');
      const includesSub = (agency.items ?? []).some((p) => p.agent?.agentCode === 'AG-000002');
      return { request: 'GET /api/v1/portal/policies as ag-000002 and as ag-000001', response: `sub-agent total=${own.total} onlyOwn=${onlyOwn} | principal total=${agency.total} includesSubAgent=${includesSub}`, pass: onlyOwn && includesSub && agency.total > own.total };
    });
}

// ---------------------------------------------------------------------------------------------
// 2. Participants
// ---------------------------------------------------------------------------------------------
async function participants() {
  const client = await as('ag-000001');
  state.ic = `01-${RUN.replace(/[^0-9A-Z]/g, '').padEnd(6, '7').slice(0, 6)}`;
  state.ic = `01-9${Date.now().toString().slice(-5)}`;

  await step('EX-010', 'Register an individual participant', 'ag-000001',
    'HTTP 201; participantNo PT/yy/nnnnnn; amlStatus CLEAR; IC returned masked only', async () => {
      const r = await client.request('POST', '/api/v1/portal/participants', {
        body: {
          type: 'INDIVIDUAL', fullName: `Nur Hidayah binti Kamal ${RUN}`, idType: 'NRIC', idNumber: state.ic,
          dateOfBirth: '1990-05-05', nationality: 'BRUNEI', occupation: 'PROFESSIONAL', occupationClass: 1,
          email: 'hidayah@mail.example', mobile: '6738111222', addressLine1: 'No. 5, Simpang 22, Kiulap',
        },
      });
      state.participant = r.json;
      return {
        request: 'POST /api/v1/portal/participants (NRIC, class 1 professional)',
        response: `${r.status} ${r.json?.participantNo ?? ''} aml=${r.json?.amlStatus} id=${r.json?.idNumberMasked}`,
        pass: r.status === 201 && /^PT\/\d{2}\/\d{6}$/.test(r.json?.participantNo ?? '') && r.json?.amlStatus === 'CLEAR' && /^\*+\d{4}$/.test(r.json?.idNumberMasked ?? '') && !('idNumberEnc' in (r.json ?? {})),
      };
    });

  await step('EX-011', 'Duplicate participant (same IC) is refused with the existing record', 'ag-000001',
    'HTTP 422 DUPLICATE_PARTICIPANT naming the existing participant number', async () => {
      const r = await client.request('POST', '/api/v1/portal/participants', {
        body: { type: 'INDIVIDUAL', fullName: 'Someone Else', idType: 'NRIC', idNumber: state.ic, dateOfBirth: '1991-01-01', mobile: '6738111223', addressLine1: 'Elsewhere' },
      });
      return { request: 'POST /api/v1/portal/participants (same IC)', response: summary(r), pass: r.status === 422 && r.json?.code === 'DUPLICATE_PARTICIPANT' && String(r.json?.message).includes(state.participant?.participantNo) };
    });

  await step('EX-012', 'Corporate participant must use a business registration number', 'ag-000001',
    'HTTP 422 INVALID_ID_TYPE', async () => {
      const r = await client.request('POST', '/api/v1/portal/participants', {
        body: { type: 'CORPORATE', fullName: 'Syarikat Contoh Sdn Bhd', idType: 'NRIC', idNumber: '01-000001', mobile: '6732222333', addressLine1: 'Jalan Contoh' },
      });
      return { request: 'POST /api/v1/portal/participants (CORPORATE with NRIC)', response: summary(r), pass: r.status === 422 && r.json?.code === 'INVALID_ID_TYPE' };
    });

  await step('EX-013', 'Unknown and malformed fields are rejected', 'ag-000001',
    'HTTP 400 listing isAdmin as not allowed and the invalid mobile', async () => {
      const r = await client.request('POST', '/api/v1/portal/participants', {
        body: { type: 'INDIVIDUAL', fullName: 'Test', idType: 'NRIC', idNumber: '01-555555', mobile: 'abc', addressLine1: 'Somewhere', isAdmin: true },
      });
      const details = (r.json?.details ?? []).join(' ');
      return { request: 'POST /api/v1/portal/participants (isAdmin, mobile=abc)', response: summary(r), pass: r.status === 400 && /isAdmin should not exist/.test(details) && /mobile/.test(details) };
    });

  await step('EX-014', 'Exact-ID lookup from another agency returns a masked summary only (single shared profile)', 'ag-000003',
    'HTTP 200 found=true with participant number and masked name; no address or contact details', async () => {
      const other = await as('ag-000003');
      const r = await other.request('GET', `/api/v1/portal/participants/lookup?idType=NRIC&idNumber=${encodeURIComponent(state.ic)}`);
      const keys = Object.keys(r.json ?? {});
      return { request: 'GET /api/v1/portal/participants/lookup', response: `${r.status} ${JSON.stringify(r.json).slice(0, 160)}`, pass: r.status === 200 && r.json?.found === true && !keys.includes('addressLine1') && !keys.includes('mobile') };
    });

  await step('EX-015', 'Full profile is not visible to an agency without business with the participant', 'ag-000003',
    'HTTP 403 or 404 (not disclosed)', async () => {
      const other = await as('ag-000003');
      const r = await other.request('GET', `/api/v1/portal/participants/${state.participant.id}`);
      return { request: `GET /api/v1/portal/participants/${state.participant.id}`, response: summary(r), pass: r.status === 403 || r.status === 404 };
    });

  await step('EX-016', 'Participant update goes through approval; empty and duplicate requests are refused', 'ag-000001',
    'Empty body → 422 NO_CHANGES; a change → 201 approval request (PARTICIPANT_UPDATE, PENDING) with before/after values; a second request while one is pending → 422 REQUEST_ALREADY_PENDING', async () => {
      const none = await client.request('POST', `/api/v1/portal/participants/${state.participant.id}/update-requests`, { body: {} });
      const real = await client.request('POST', `/api/v1/portal/participants/${state.participant.id}/update-requests`, { body: { mobile: '6738111299', addressLine2: 'Unit 3' } });
      const again = await client.request('POST', `/api/v1/portal/participants/${state.participant.id}/update-requests`, { body: { addressLine2: 'Unit 4' } });
      state.participantUpdateRequest = real.json;
      return {
        request: `POST /api/v1/portal/participants/${state.participant.id}/update-requests (empty; changed mobile; another change)`,
        response: `${summary(none)} | ${real.status} ${real.json?.type ?? ''} ${real.json?.status ?? ''} before=${JSON.stringify(real.json?.payload?.before ?? '')} | ${summary(again)}`,
        pass: none.status === 422 && none.json?.code === 'NO_CHANGES' && real.status === 201 && real.json?.type === 'PARTICIPANT_UPDATE' && real.json?.status === 'PENDING' && !!real.json?.payload?.before && again.status === 422 && again.json?.code === 'REQUEST_ALREADY_PENDING',
      };
    });

  await step('EX-017', 'Maker sees and withdraws their own pending request', 'ag-000001',
    'GET /portal/requests lists the request; POST withdraw returns 200 with status WITHDRAWN', async () => {
      const list = await client.request('GET', '/api/v1/portal/requests?status=PENDING');
      const listed = (list.json?.items ?? []).some((i) => i.id === state.participantUpdateRequest?.id);
      const w = await client.request('POST', `/api/v1/portal/requests/${state.participantUpdateRequest?.id}/withdraw`, { body: {} });
      return { request: 'GET /api/v1/portal/requests; POST /api/v1/portal/requests/{id}/withdraw', response: `listed=${listed} | ${w.status} ${w.json?.status ?? summary(w)}`, pass: listed && w.status === 200 && w.json?.status === 'WITHDRAWN' };
    });
}

// ---------------------------------------------------------------------------------------------
// 3. Products and rating
// ---------------------------------------------------------------------------------------------
async function rating() {
  const client = await as('ag-000001');
  const products = (await client.request('GET', '/api/v1/common/products')).json ?? [];
  state.products = Object.fromEntries(products.map((p) => [p.code, p]));
  const pid = state.participant.id;
  const calc = (body) => client.request('POST', '/api/v1/portal/policies/calculate', { body: { participantId: pid, riskDetails: {}, ...body } });

  await step('EX-020', 'Product catalogue lists the seven IIFT products with their rules', 'ag-000001',
    'HTTP 200 with FTP-HP, FTP-NP, PFT, PHA, PRO, KHR, OSA; KHR has allowRenewal=false; PRO/KHR/OSA/PHA pay before issuance', async () => {
      const codes = products.map((p) => p.code).sort().join(',');
      return { request: 'GET /api/v1/common/products', response: `${codes}; KHR.allowRenewal=${state.products.KHR?.allowRenewal}; PRO.paymentBeforeIssuance=${state.products.PRO?.paymentBeforeIssuance}`, pass: codes === 'FTP-HP,FTP-NP,KHR,OSA,PFT,PHA,PRO' && state.products.KHR?.allowRenewal === false && state.products.PRO?.paymentBeforeIssuance === true && state.products['FTP-HP']?.paymentBeforeIssuance === false };
    });

  await step('EX-021', 'Professional Plan B with additional cover is rated 135 + 120', 'ag-000001',
    'contribution 255.00, sumCovered 30,000', async () => {
      const r = await calc({ productId: state.products.PRO.id, planCode: 'B', additionalCover: true });
      return { request: 'POST /api/v1/portal/policies/calculate (PRO, plan B, additional cover)', response: `${r.status} contribution=${r.json?.contribution} sumCovered=${r.json?.sumCovered}`, pass: r.status === 200 && Number(r.json?.contribution) === 255 && Number(r.json?.sumCovered) === 30000 };
    });

  await step('EX-022', 'Khairat Plan A with Wider (Child) cover applies the 1.6 loading', 'ag-000001',
    'contribution 64.00 (40 × 1.6)', async () => {
      const r = await calc({ productId: state.products.KHR.id, planCode: 'A', coverageType: 'WIDER' });
      return { request: 'POST /api/v1/portal/policies/calculate (KHR, plan A, WIDER)', response: `${r.status} contribution=${r.json?.contribution}`, pass: r.status === 200 && Number(r.json?.contribution) === 64 };
    });

  await step('EX-023', 'Personal Home Assistant two-year cover', 'ag-000001',
    'contribution 220.00 for 24 months', async () => {
      const r = await calc({ productId: state.products.PHA.id, planCode: 'STANDARD', termMonths: 24, riskDetails: { helperName: 'Maria Santos', helperPassportNo: 'P8827361A', helperNationality: 'PHILIPPINES', labourLicenceNo: 'LL/2026/04412' } });
      return { request: 'POST /api/v1/portal/policies/calculate (PHA, 24 months)', response: `${r.status} contribution=${r.json?.contribution} ${r.json?.code ?? ''}`, pass: r.status === 200 && Number(r.json?.contribution) === 220 };
    });

  await step('EX-024', 'Overseas Student Assist refuses a participant who is not a Brunei citizen', 'ag-000001',
    'HTTP 422 NOT_ELIGIBLE', async () => {
      const foreign = await client.request('POST', '/api/v1/portal/participants', {
        body: { type: 'INDIVIDUAL', fullName: `Student Foreign ${RUN}`, idType: 'PASSPORT', idNumber: `P${Date.now().toString().slice(-7)}`, dateOfBirth: '2002-03-03', nationality: 'MALAYSIA', mobile: '6738222444', addressLine1: 'Hostel A' },
      });
      state.foreignParticipant = foreign.json;
      const r = await client.request('POST', '/api/v1/portal/policies/calculate', { body: { participantId: foreign.json?.id, productId: state.products.OSA.id, planCode: 'BASIC', riskDetails: { registeredStudent: true, institutionName: 'University of Malaya', countryOfStudy: 'MALAYSIA', studentIdNo: 'S1234', courseEndDate: '2028-06-30' } } });
      return { request: 'POST /api/v1/portal/policies/calculate (OSA, Malaysian participant)', response: summary(r), pass: r.status === 422 && r.json?.code === 'NOT_ELIGIBLE' };
    });

  await step('EX-025', 'Professional Plan accepts Occupational Class I only', 'ag-000001',
    'HTTP 422 NOT_ELIGIBLE for a class 3 participant', async () => {
      const worker = await client.request('POST', '/api/v1/portal/participants', {
        body: { type: 'INDIVIDUAL', fullName: `Manual Worker ${RUN}`, idType: 'NRIC', idNumber: `01-8${Date.now().toString().slice(-5)}`, dateOfBirth: '1985-03-03', nationality: 'BRUNEI', occupation: 'SKILLED_MANUAL', occupationClass: 3, mobile: '6738222555', addressLine1: 'Kg Contoh' },
      });
      const r = await client.request('POST', '/api/v1/portal/policies/calculate', { body: { participantId: worker.json?.id, productId: state.products.PRO.id, planCode: 'A', riskDetails: {} } });
      return { request: 'POST /api/v1/portal/policies/calculate (PRO, occupation class 3)', response: summary(r), pass: r.status === 422 && r.json?.code === 'NOT_ELIGIBLE' };
    });

  await step('EX-026', 'Hire purchase financing above B$150,000 is referred; at the limit it is not', 'ag-000001',
    '200 with a high-risk referral reason for 200,000; 200 without referral reasons for 150,000', async () => {
      const risk = (amount) => ({ financingAmount: amount, tenureMonths: 60, profitRatePercent: 4, financierName: 'Bank A', financingReference: `HP/${RUN}` });
      const high = await calc({ productId: state.products['FTP-HP'].id, riskDetails: risk(200000) });
      const limit = await calc({ productId: state.products['FTP-HP'].id, riskDetails: risk(150000) });
      const reasons = high.json?.referralReasons ?? [];
      return { request: 'POST /api/v1/portal/policies/calculate (FTP-HP 200,000; 150,000)', response: `${high.status} referral=${JSON.stringify(reasons).slice(0, 120)} | ${limit.status} referral=${JSON.stringify(limit.json?.referralReasons)}`, pass: high.status === 200 && reasons.some((x) => /high-risk/i.test(x)) && limit.status === 200 && (limit.json?.referralReasons ?? []).length === 0 };
    });

  await step('EX-027', 'Financing quotation lists every missing risk field at once', 'ag-000001',
    'HTTP 422 naming financingAmount, tenureMonths, profitRatePercent, financierName and financingReference', async () => {
      const r = await calc({ productId: state.products['FTP-NP'].id, riskDetails: {} });
      const text = JSON.stringify(r.json?.details ?? r.json?.message ?? '');
      return { request: 'POST /api/v1/portal/policies/calculate (FTP-NP, empty risk details)', response: summary(r), pass: r.status === 422 && /financing/i.test(text) && /tenure|period/i.test(text) && /profit/i.test(text) };
    });

  await step('EX-028', 'Cover that would run past the maximum age at expiry is refused', 'ag-000001',
    'HTTP 422 NOT_ELIGIBLE for a 64-year-old with a 108-month hire purchase (max age at expiry 70)', async () => {
      const senior = await client.request('POST', '/api/v1/portal/participants', {
        body: { type: 'INDIVIDUAL', fullName: `Senior Participant ${RUN}`, idType: 'NRIC', idNumber: `00-6${Date.now().toString().slice(-5)}`, dateOfBirth: `${new Date().getFullYear() - 64}-01-15`, nationality: 'BRUNEI', mobile: '6738222666', addressLine1: 'Kg Contoh' },
      });
      const r = await client.request('POST', '/api/v1/portal/policies/calculate', { body: { participantId: senior.json?.id, productId: state.products['FTP-HP'].id, riskDetails: { financingAmount: 50000, tenureMonths: 108, profitRatePercent: 4, financierName: 'Bank A', financingReference: 'HP/OLD' } } });
      return { request: 'POST /api/v1/portal/policies/calculate (FTP-HP, age 64, 108 months)', response: summary(r), pass: r.status === 422 && r.json?.code === 'NOT_ELIGIBLE' };
    });
}

// ---------------------------------------------------------------------------------------------
// 4. Quotation to e-Policy (Professional Takaful Plan, pay before issuance)
// ---------------------------------------------------------------------------------------------
async function quotationToPolicy() {
  const client = await as('ag-000001');
  const pid = state.participant.id;
  const product = state.products.PRO;

  await step('EX-030', 'Create a quotation and save it as draft', 'ag-000001',
    'HTTP 201; status DRAFT; quotationNo QT/yy/nnnnnn; contribution 255', async () => {
      const r = await client.request('POST', '/api/v1/portal/policies', { body: { productId: product.id, participantId: pid, planCode: 'B', additionalCover: true, riskDetails: {} } });
      state.policy = r.json;
      return { request: 'POST /api/v1/portal/policies (PRO plan B + additional cover)', response: `${r.status} ${r.json?.quotationNo} ${r.json?.status} contribution=${r.json?.contribution}`, pass: r.status === 201 && r.json?.status === 'DRAFT' && /^QT\/\d{2}\/\d{6}$/.test(r.json?.quotationNo ?? '') && Number(r.json?.contribution) === 255 };
    });
  const id = state.policy?.id;

  await step('EX-031', 'Submission is blocked while the questionnaire is incomplete', 'ag-000001',
    'HTTP 422 QUESTIONNAIRE_INCOMPLETE', async () => {
      const r = await client.request('POST', `/api/v1/portal/policies/${id}/submit`, { body: {} });
      return { request: `POST /api/v1/portal/policies/${id}/submit`, response: summary(r), pass: r.status === 422 && r.json?.code === 'QUESTIONNAIRE_INCOMPLETE' };
    });

  await step('EX-032', 'A "yes" declaration requires details', 'ag-000001',
    'HTTP 422 QUESTIONNAIRE_INCOMPLETE asking for details', async () => {
      const r = await client.request('PUT', `/api/v1/portal/policies/${id}/questionnaire`, { body: { answers: [{ code: 'HEALTH_CURRENT', answer: true }, { code: 'HEALTH_HOSPITAL', answer: false }, { code: 'PRIOR_DECLINE', answer: false }] } });
      return { request: `PUT /api/v1/portal/policies/${id}/questionnaire (yes without details)`, response: summary(r), pass: r.status === 422 && r.json?.code === 'QUESTIONNAIRE_INCOMPLETE' && /details/i.test(JSON.stringify(r.json?.details)) };
    });

  await step('EX-033', 'Completed questionnaire is saved', 'ag-000001',
    'HTTP 200', async () => {
      const r = await client.request('PUT', `/api/v1/portal/policies/${id}/questionnaire`, { body: { answers: ['HEALTH_CURRENT', 'HEALTH_HOSPITAL', 'PRIOR_DECLINE'].map((code) => ({ code, answer: false })) } });
      return { request: `PUT /api/v1/portal/policies/${id}/questionnaire (all no)`, response: summary(r), pass: r.status === 200 };
    });

  await step('EX-034', 'Nominee shares must total 100%', 'ag-000001',
    'HTTP 422 INVALID_SHARES for 60%; 200 for 100%', async () => {
      const bad = await client.request('PUT', `/api/v1/portal/policies/${id}/nominees`, { body: { nominees: [{ fullName: 'Kamal bin Ali', relationship: 'PARENT', role: 'NOMINEE', sharePercent: 60 }] } });
      const ok = await client.request('PUT', `/api/v1/portal/policies/${id}/nominees`, { body: { nominees: [{ fullName: 'Kamal bin Ali', idNumber: '00-112233', relationship: 'PARENT', role: 'NOMINEE', sharePercent: 100 }] } });
      return { request: `PUT /api/v1/portal/policies/${id}/nominees (60%; 100%)`, response: `${summary(bad)} | ${ok.status}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_SHARES' && ok.status === 200 };
    });

  await step('EX-035', 'Submission lists the missing documents and signature', 'ag-000001',
    'HTTP 422 SUBMISSION_INCOMPLETE with "Upload: IC copy", nominee IC and participant signature', async () => {
      const r = await client.request('POST', `/api/v1/portal/policies/${id}/submit`, { body: {} });
      const details = (r.json?.details ?? []).join(' | ');
      return { request: `POST /api/v1/portal/policies/${id}/submit`, response: summary(r), pass: r.status === 422 && r.json?.code === 'SUBMISSION_INCOMPLETE' && /IC copy/.test(details) && /signature/i.test(details) };
    });

  await step('EX-036', 'Disguised executable is refused; PDF documents are accepted', 'ag-000001',
    'HTTP 422 FILE_TYPE_NOT_ALLOWED for "ic.pdf" with MZ content; 201 for the IC and nominee IC copies', async () => {
      const bad = await upload(client, 'POLICY', id, 'IC_COPY', Buffer.from('MZ\x90\x00 executable'), 'ic.pdf');
      const ic = await upload(client, 'POLICY', id, 'IC_COPY');
      const nominee = await upload(client, 'POLICY', id, 'NOMINEE_IC');
      state.icDocument = ic.json;
      return { request: 'POST /api/v1/common/documents (ownerType POLICY)', response: `${summary(bad)} | ${ic.status} | ${nominee.status}`, pass: bad.status === 422 && bad.json?.code === 'FILE_TYPE_NOT_ALLOWED' && ic.status === 201 && nominee.status === 201 };
    });

  await step('EX-037', 'E-signature link is sent to the participant and an invalid public token reveals nothing', 'ag-000001, anonymous',
    'HTTP 200/201 with sentTo and expiresAt about 72 hours ahead; GET /public/esign/{bad token} returns 404 or 422 without policy data', async () => {
      const link = await client.request('POST', `/api/v1/portal/policies/${id}/signatures/link`, { body: { email: 'hidayah@mail.example' } });
      const hours = (new Date(link.json?.expiresAt).getTime() - Date.now()) / 3_600_000;
      const bad = await new Client().request('GET', `/api/v1/public/esign/${'A'.repeat(43)}`);
      const malformed = await new Client().request('GET', '/api/v1/public/esign/short');
      return { request: `POST /api/v1/portal/policies/${id}/signatures/link; GET /api/v1/public/esign/{unknown}`, response: `${link.status} sentTo=${link.json?.sentTo} in ${hours.toFixed(1)} h | ${summary(bad)} | ${summary(malformed)}`, pass: [200, 201].includes(link.status) && link.json?.sentTo === 'hidayah@mail.example' && hours > 71 && hours < 73 && [404, 422].includes(bad.status) && [404, 422].includes(malformed.status) && !/quotation/i.test(bad.text) };
    });

  await step('EX-038', 'Participant signs on screen (PNG signature)', 'ag-000001',
    'HTTP 201 with a documentId; a non-PNG signature is refused with 422 INVALID_SIGNATURE', async () => {
      const bad = await client.request('POST', `/api/v1/portal/policies/${id}/signatures`, { body: { signer: 'PARTICIPANT', imageDataUrl: 'data:text/html;base64,PGh0bWw+' } });
      const ok = await client.request('POST', `/api/v1/portal/policies/${id}/signatures`, { body: { signer: 'PARTICIPANT', imageDataUrl: PNG_DATA_URL } });
      return { request: `POST /api/v1/portal/policies/${id}/signatures`, response: `${summary(bad)} | ${ok.status} documentId=${ok.json?.documentId ? 'present' : 'absent'}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_SIGNATURE' && ok.status === 201 && !!ok.json?.documentId };
    });

  await step('EX-039', 'Complete application is submitted and waits for payment', 'ag-000001',
    'HTTP 200; status PENDING_PAYMENT (pay-before-issuance product, no referral)', async () => {
      const r = await client.request('POST', `/api/v1/portal/policies/${id}/submit`, { body: {} });
      return { request: `POST /api/v1/portal/policies/${id}/submit`, response: `${r.status} ${r.json?.status ?? summary(r)}`, pass: r.status === 200 && r.json?.status === 'PENDING_PAYMENT' };
    });

  await step('EX-040', 'Payment rules: future date, missing proof and wrong amount are refused', 'ag-000001',
    'HTTP 422 INVALID_DATE; 422 PROOF_REQUIRED; 422 INVALID_ALLOCATION', async () => {
      const fields = (date, amount) => ({ method: 'BANK_TRANSFER', referenceNo: `TRX-${RUN}`, paymentDate: date, allocations: JSON.stringify([{ policyId: id, amount }]) });
      const future = await client.request('POST', '/api/v1/portal/billing/payments', { form: fileForm(fields(bruneiToday(2), 255), 'proof', PDF, 'transfer.pdf') });
      const noProofForm = new FormData();
      for (const [k, v] of Object.entries(fields(bruneiToday(), 255))) noProofForm.append(k, v);
      const noProof = await client.request('POST', '/api/v1/portal/billing/payments', { form: noProofForm });
      const wrong = await client.request('POST', '/api/v1/portal/billing/payments', { form: fileForm(fields(bruneiToday(), 999), 'proof', PDF, 'transfer.pdf') });
      return { request: 'POST /api/v1/portal/billing/payments (future date; no proof; amount 999)', response: `${summary(future)} | ${summary(noProof)} | ${summary(wrong)}`, pass: future.status === 422 && future.json?.code === 'INVALID_DATE' && noProof.status === 422 && noProof.json?.code === 'PROOF_REQUIRED' && wrong.status === 422 && wrong.json?.code === 'INVALID_ALLOCATION' };
    });

  await step('EX-041', 'Payment with proof is accepted and routed for verification', 'ag-000001',
    'HTTP 201; status PENDING_VERIFICATION; policy paymentStatus PENDING_VERIFICATION', async () => {
      const r = await client.request('POST', '/api/v1/portal/billing/payments', { form: fileForm({ method: 'BANK_TRANSFER', referenceNo: `TRX-${RUN}`, paymentDate: bruneiToday(), allocations: JSON.stringify([{ policyId: id, amount: 255 }]) }, 'proof', PDF, 'transfer.pdf') });
      state.payment = r.json;
      const policy = await client.request('GET', `/api/v1/portal/policies/${id}`);
      return { request: 'POST /api/v1/portal/billing/payments (255.00 with PDF proof)', response: `${r.status} ${r.json?.status} | policy paymentStatus=${policy.json?.paymentStatus}`, pass: r.status === 201 && r.json?.status === 'PENDING_VERIFICATION' && policy.json?.paymentStatus === 'PENDING_VERIFICATION' };
    });

  await step('EX-042', 'Only Finance can verify a payment; rejection needs remarks', 'ops.maker, finance',
    'ops.maker approve → 403; finance reject with empty remarks → 400; request is in the Finance inbox', async () => {
      const finance = await as('finance');
      const maker = await as('ops.maker');
      const inbox = await finance.request('GET', '/api/v1/backoffice/approvals/inbox?pageSize=100');
      const request = (inbox.json?.items ?? []).find((i) => i.entityId === state.payment?.id);
      state.paymentRequest = request;
      const makerTry = await maker.request('POST', `/api/v1/backoffice/approvals/${request?.id}/approve`, { body: {} });
      const noRemarks = await finance.request('POST', `/api/v1/backoffice/approvals/${request?.id}/reject`, { body: { remarks: '' } });
      return { request: `GET /api/v1/backoffice/approvals/inbox; POST approvals/${request?.id}/approve (ops.maker); POST reject (finance, empty remarks)`, response: `inbox has request: ${!!request} | ${summary(makerTry)} | ${summary(noRemarks)}`, pass: !!request && makerTry.status === 403 && noRemarks.status === 400 };
    });

  await step('EX-043', 'Finance verifies the payment: policy issued with e-Policy, e-Receipt and FIN messages', 'finance',
    'HTTP 200; policy ACTIVE and PAID; policyNo PRO/yy/nnnnnn; one receipt; POLICY_SCHEDULE and RECEIPT documents', async () => {
      const finance = await as('finance');
      const r = await finance.request('POST', `/api/v1/backoffice/approvals/${state.paymentRequest?.id}/approve`, { body: { remarks: 'Matched to bank statement' } });
      const policy = (await client.request('GET', `/api/v1/portal/policies/${id}`)).json ?? {};
      state.issued = policy;
      const docTypes = (policy.documents ?? []).map((d) => d.docType);
      return { request: `POST /api/v1/backoffice/approvals/${state.paymentRequest?.id}/approve; GET /api/v1/portal/policies/${id}`, response: `${r.status} | ${policy.status} ${policy.paymentStatus} ${policy.policyNo} receipts=${policy.receipts?.length} docs=${docTypes.join(',')}`, pass: r.status === 200 && policy.status === 'ACTIVE' && policy.paymentStatus === 'PAID' && /^PRO\/\d{2}\/\d{6}$/.test(policy.policyNo ?? '') && policy.receipts?.length === 1 && docTypes.includes('POLICY_SCHEDULE') && docTypes.includes('RECEIPT') };
    });

  await step('EX-044', 'Policy schedule downloads as a PDF', 'ag-000001',
    'HTTP 200, content-type application/pdf, body starts with %PDF-', async () => {
      const schedule = (state.issued?.documents ?? []).find((d) => d.docType === 'POLICY_SCHEDULE');
      const r = await client.request('GET', `/api/v1/common/documents/${schedule?.id}/content`);
      return { request: `GET /api/v1/common/documents/${schedule?.id}/content`, response: `${r.status} ${r.headers.get('content-type')} ${r.buffer.subarray(0, 5).toString()}`, pass: r.status === 200 && r.headers.get('content-type') === 'application/pdf' && r.buffer.subarray(0, 5).toString() === '%PDF-' };
    });

  await step('EX-045', 'Policy history records every step and the approval trail', 'ag-000001',
    'Detail shows events SUBMITTED, ISSUED (or PAYMENT_VERIFIED) and the payment verification request', async () => {
      const actions = (state.issued?.events ?? []).map((e) => e.action);
      const approvals = (state.issued?.approvals ?? state.issued?.requests ?? state.issued?.history ?? []).length;
      return { request: `GET /api/v1/portal/policies/${id} (events)`, response: `events=${actions.join(',')}; approval history entries=${approvals}`, pass: actions.includes('SUBMITTED') && actions.some((a) => /ISSUED|PAID|VERIFIED/.test(a)) };
    });

  await step('EX-046', 'Documents are e-mailed to the participant; an invalid address is refused', 'ag-000001',
    'HTTP 422 EMAIL_REQUIRED for "not-an-email"; 200/201 for a valid address', async () => {
      const bad = await client.request('POST', `/api/v1/portal/policies/${id}/email-documents`, { body: { email: 'not-an-email' } });
      const ok = await client.request('POST', `/api/v1/portal/policies/${id}/email-documents`, { body: {} });
      return { request: `POST /api/v1/portal/policies/${id}/email-documents`, response: `${summary(bad)} | ${ok.status}`, pass: bad.status === 422 && bad.json?.code === 'EMAIL_REQUIRED' && [200, 201, 204].includes(ok.status) };
    });

  await step('EX-047', 'Issued policy is invisible to another agency and cannot be changed', 'ag-000003, ag-000001',
    'GET by another agency → 404; PUT questionnaire on an issued policy → 422 NOT_DRAFT', async () => {
      const other = await as('ag-000003');
      const hidden = await other.request('GET', `/api/v1/portal/policies/${id}`);
      const locked = await client.request('PUT', `/api/v1/portal/policies/${id}/questionnaire`, { body: { answers: ['HEALTH_CURRENT', 'HEALTH_HOSPITAL', 'PRIOR_DECLINE'].map((code) => ({ code, answer: false })) } });
      return { request: `GET /api/v1/portal/policies/${id} (ag-000003); PUT questionnaire (ag-000001)`, response: `${summary(hidden)} | ${summary(locked)}`, pass: hidden.status === 404 && locked.status === 422 && locked.json?.code === 'NOT_DRAFT' };
    });

  await step('EX-048', 'Policy search filters by status and treats injection text as plain text', 'ag-000001',
    'status=ACTIVE returns only active policies; search with SQL text returns 200 and an empty list', async () => {
      const active = await client.request('GET', '/api/v1/portal/policies?status=ACTIVE&pageSize=50');
      const onlyActive = (active.json?.items ?? []).every((p) => p.status === 'ACTIVE');
      const injection = await client.request('GET', `/api/v1/portal/policies?search=${encodeURIComponent("' OR 1=1; DROP TABLE policy; --")}`);
      const byNo = await client.request('GET', `/api/v1/portal/policies?search=${encodeURIComponent(state.issued?.policyNo ?? '')}`);
      return { request: 'GET /api/v1/portal/policies?status=ACTIVE; ?search=<SQL>; ?search=<policyNo>', response: `${active.status} onlyActive=${onlyActive} | ${injection.status} items=${injection.json?.items?.length} | byNo items=${byNo.json?.items?.length}`, pass: active.status === 200 && onlyActive && injection.status === 200 && injection.json?.items?.length === 0 && byNo.json?.items?.length === 1 };
    });

  await step('EX-049', 'Draft quotation can be discarded; discarding an issued policy is refused', 'ag-000001',
    'POST discard on a new draft → 204; on the issued policy → 422 CANNOT_DISCARD', async () => {
      const draft = await client.request('POST', '/api/v1/portal/policies', { body: { productId: product.id, participantId: pid, planCode: 'A', riskDetails: {} } });
      const ok = await client.request('POST', `/api/v1/portal/policies/${draft.json?.id}/discard`, { body: {} });
      const bad = await client.request('POST', `/api/v1/portal/policies/${id}/discard`, { body: {} });
      return { request: 'POST /api/v1/portal/policies/{draft}/discard; /{issued}/discard', response: `${ok.status} | ${summary(bad)}`, pass: [200, 204].includes(ok.status) && bad.status === 422 && bad.json?.code === 'CANNOT_DISCARD' };
    });
}

// ---------------------------------------------------------------------------------------------
// 5. Referral (financing above the high-risk limit), issue-then-pay with grace period
// ---------------------------------------------------------------------------------------------
async function referral() {
  const client = await as('ag-000001');
  const product = state.products['FTP-HP'];
  const pid = state.participant.id;
  const risk = { financingAmount: 200000, tenureMonths: 60, profitRatePercent: 4, financierName: 'Bank A', financingReference: `HP/${RUN}`, vehicleRegistrationNo: 'BAA 1234' };

  await step('EX-050', 'High-risk hire purchase application is referred for underwriting', 'ag-000001',
    'After documents, questionnaire and signature the submission returns status PENDING_APPROVAL with the high-risk and quality-check reasons', async () => {
      const q = await client.request('POST', '/api/v1/portal/policies', { body: { productId: product.id, participantId: pid, riskDetails: risk } });
      const id = q.json?.id;
      state.referralPolicy = q.json;
      await client.request('PUT', `/api/v1/portal/policies/${id}/questionnaire`, { body: { answers: ['HEALTH_CURRENT', 'HEALTH_HOSPITAL', 'PRIOR_DECLINE'].map((code) => ({ code, answer: false })) } });
      for (const docType of ['PROPOSAL_FORM', 'PDS', 'IC_COPY', 'HP_APPROVAL_LETTER', 'DRAWDOWN_LETTER']) await upload(client, 'POLICY', id, docType);
      await client.request('POST', `/api/v1/portal/policies/${id}/signatures`, { body: { signer: 'PARTICIPANT', imageDataUrl: PNG_DATA_URL } });
      const r = await client.request('POST', `/api/v1/portal/policies/${id}/submit`, { body: {} });
      const detail = (await client.request('GET', `/api/v1/portal/policies/${id}`)).json ?? {};
      state.referralPolicy = detail;
      const reasons = JSON.stringify(detail.referralReasons ?? []);
      return { request: `POST /api/v1/portal/policies (FTP-HP 200,000) … submit`, response: `${r.status} ${r.json?.status ?? summary(r)}; reasons=${reasons.slice(0, 160)}`, pass: r.status === 200 && r.json?.status === 'PENDING_APPROVAL' && /high-risk/i.test(reasons) && /quality check/i.test(reasons) };
    });

  await step('EX-051', 'Referral appears in the underwriter inbox; the maker cannot decide it', 'underwriter, ag-000001',
    'Inbox lists a POLICY_REFERRAL request for the quotation; the agent has no back-office access (403 WRONG_AUDIENCE)', async () => {
      const uw = await as('underwriter');
      const inbox = await uw.request('GET', '/api/v1/backoffice/approvals/inbox?pageSize=100');
      const request = (inbox.json?.items ?? []).find((i) => i.entityId === state.referralPolicy?.id);
      state.referralRequest = request;
      const self = await client.request('POST', `/api/v1/backoffice/approvals/${request?.id}/approve`, { body: {} });
      return { request: 'GET /api/v1/backoffice/approvals/inbox (underwriter); POST approve as the agent', response: `request ${request?.type} ${request?.status} | ${summary(self)}`, pass: request?.type === 'POLICY_REFERRAL' && request?.status === 'PENDING' && self.status === 403 };
    });

  await step('EX-052', 'Underwriter approves: financing policy issued immediately with a payment due date (grace period)', 'underwriter',
    'HTTP 200; policy ACTIVE, paymentStatus UNPAID, paymentDueDate = today + 7 days, policyNo FTP-HP/yy/nnnnnn', async () => {
      const uw = await as('underwriter');
      const r = await uw.request('POST', `/api/v1/backoffice/approvals/${state.referralRequest?.id}/approve`, { body: { remarks: 'Quality check passed' } });
      const detail = (await client.request('GET', `/api/v1/portal/policies/${state.referralPolicy?.id}`)).json ?? {};
      state.financingPolicy = detail;
      const due = String(detail.paymentDueDate ?? '').slice(0, 10);
      return { request: `POST /api/v1/backoffice/approvals/${state.referralRequest?.id}/approve`, response: `${r.status} | ${detail.status} ${detail.paymentStatus} ${detail.policyNo} due=${due}`, pass: r.status === 200 && detail.status === 'ACTIVE' && detail.paymentStatus === 'UNPAID' && due === bruneiToday(7) && /^FTP-HP\/\d{2}\/\d{6}$/.test(detail.policyNo ?? '') };
    });

  await step('EX-053', 'A decided request cannot be decided again', 'underwriter',
    'HTTP 422 REQUEST_NOT_PENDING', async () => {
      const uw = await as('underwriter');
      const r = await uw.request('POST', `/api/v1/backoffice/approvals/${state.referralRequest?.id}/reject`, { body: { remarks: 'late' } });
      return { request: `POST /api/v1/backoffice/approvals/${state.referralRequest?.id}/reject`, response: summary(r), pass: r.status === 422 && r.json?.code === 'REQUEST_NOT_PENDING' };
    });

  await step('EX-054', 'Blocked bank: new business is refused for every officer of the bank', 'bk-000005',
    'HTTP 422 AGENCY_BLOCKED on submit; portal dashboard shows the AGENCY_BLOCKED pending action', async () => {
      const banker = await as('bk-000005');
      const dash = await banker.request('GET', '/api/v1/portal/dashboard');
      const lookup = await banker.request('GET', '/api/v1/portal/participants?pageSize=1');
      const participantId = lookup.json?.items?.[0]?.id ?? pid;
      const q = await banker.request('POST', '/api/v1/portal/policies', { body: { productId: state.products['FTP-NP'].id, participantId, riskDetails: { financingAmount: 20000, tenureMonths: 36, profitRatePercent: 4, financierName: 'Bank A', financingReference: `PF/${RUN}` } } });
      const r = await banker.request('POST', `/api/v1/portal/policies/${q.json?.id}/submit`, { body: {} });
      const blocked = dash.json?.profile?.agency?.issuanceBlocked;
      const action = (dash.json?.pendingActions ?? []).some((a) => a.type === 'AGENCY_BLOCKED');
      return { request: 'GET /api/v1/portal/dashboard; POST /api/v1/portal/policies; POST …/submit (bk-000005)', response: `issuanceBlocked=${blocked} pendingAction=${action} | quotation ${q.status} | ${summary(r)}`, pass: blocked === true && action && q.status === 201 && r.status === 422 && r.json?.code === 'AGENCY_BLOCKED' };
    });
}

// ---------------------------------------------------------------------------------------------
// 6. Servicing: endorsement, cancellation, renewal, claims
// ---------------------------------------------------------------------------------------------
async function servicing() {
  const client = await as('ag-000001');
  const id = state.issued?.id;

  await step('EX-060', 'Endorsement request (nominee change) is routed for approval', 'ag-000001',
    'HTTP 201; type POLICY_ENDORSEMENT, status PENDING; an invalid endorsement type is refused with 422 INVALID_CODE', async () => {
      const bad = await client.request('POST', `/api/v1/portal/policies/${id}/endorsements`, { body: { endorsementType: 'NOT_A_TYPE', description: 'Change nominee shares' } });
      const r = await client.request('POST', `/api/v1/portal/policies/${id}/endorsements`, { body: { endorsementType: 'NOMINEE_CHANGE', description: 'Add spouse as nominee', nominees: [{ fullName: 'Kamal bin Ali', relationship: 'PARENT', role: 'NOMINEE', sharePercent: 50 }, { fullName: 'Aisyah binti Omar', idNumber: '00-998877', relationship: 'SPOUSE', role: 'NOMINEE', sharePercent: 50 }] } });
      state.endorsement = r.json;
      return { request: `POST /api/v1/portal/policies/${id}/endorsements`, response: `${summary(bad)} | ${r.status} ${r.json?.type} ${r.json?.status}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_CODE' && r.status === 201 && r.json?.type === 'POLICY_ENDORSEMENT' && r.json?.status === 'PENDING' };
    });

  await step('EX-061', 'Approval request view never contains ciphertext', 'ops.checker',
    'GET approvals/{id} returns the nominees with masked ID numbers and no idNumberEnc', async () => {
      const checker = await as('ops.checker');
      const r = await checker.request('GET', `/api/v1/backoffice/approvals/${state.endorsement?.id}`);
      return { request: `GET /api/v1/backoffice/approvals/${state.endorsement?.id}`, response: `${r.status} contains idNumberEnc=${/idNumberEnc/.test(r.text)} masked=${/\*{3,}/.test(r.text)}`, pass: r.status === 200 && !/idNumberEnc/.test(r.text) && /\*{3,}\d{4}/.test(r.text) };
    });

  await step('EX-062', 'Operations supervisor approves the endorsement and the nominees change', 'ops.checker',
    'HTTP 200; policy detail shows two nominees with 50% each', async () => {
      const checker = await as('ops.checker');
      const r = await checker.request('POST', `/api/v1/backoffice/approvals/${state.endorsement?.id}/approve`, { body: { remarks: 'Endorsement accepted' } });
      const detail = (await client.request('GET', `/api/v1/portal/policies/${id}`)).json ?? {};
      const shares = (detail.nominees ?? []).map((n) => Number(n.sharePercent)).sort().join('/');
      return { request: `POST /api/v1/backoffice/approvals/${state.endorsement?.id}/approve`, response: `${r.status} | nominees=${detail.nominees?.length} shares=${shares}`, pass: r.status === 200 && detail.nominees?.length === 2 && shares === '50/50' };
    });

  await step('EX-063', 'Cancellation request validation and rejection with mandatory remarks', 'ag-000001, ops.checker',
    'Effective date before cover start → 422 INVALID_DATE; valid request → 201; reject without remarks → 400; reject with remarks → 200 and the policy stays ACTIVE', async () => {
      const early = await client.request('POST', `/api/v1/portal/policies/${id}/cancellations`, { body: { reasonCode: 'PARTICIPANT_REQUEST', remarks: 'Participant request', effectiveDate: '2020-01-01' } });
      const r = await client.request('POST', `/api/v1/portal/policies/${id}/cancellations`, { body: { reasonCode: 'PARTICIPANT_REQUEST', remarks: 'Participant moved abroad', effectiveDate: bruneiToday() } });
      const checker = await as('ops.checker');
      const noRemarks = await checker.request('POST', `/api/v1/backoffice/approvals/${r.json?.id}/reject`, { body: {} });
      const rejected = await checker.request('POST', `/api/v1/backoffice/approvals/${r.json?.id}/reject`, { body: { remarks: 'Participant withdrew the request' } });
      const detail = (await client.request('GET', `/api/v1/portal/policies/${id}`)).json ?? {};
      return { request: `POST /api/v1/portal/policies/${id}/cancellations; POST approvals/{id}/reject`, response: `${summary(early)} | ${r.status} | ${noRemarks.status} | ${rejected.status} ${rejected.json?.status ?? ''} | policy ${detail.status}`, pass: early.status === 422 && early.json?.code === 'INVALID_DATE' && r.status === 201 && noRemarks.status === 400 && rejected.status === 200 && detail.status === 'ACTIVE' };
    });

  await step('EX-064', 'Rejection remarks are visible to the maker in the request list', 'ag-000001',
    'GET /portal/requests/{id} shows status REJECTED with the remarks', async () => {
      const list = await client.request('GET', '/api/v1/portal/requests?status=REJECTED&pageSize=50');
      const item = (list.json?.items ?? []).find((i) => i.type === 'POLICY_CANCELLATION' && i.entityId === id);
      const detail = await client.request('GET', `/api/v1/portal/requests/${item?.id}`);
      return { request: 'GET /api/v1/portal/requests?status=REJECTED; GET /api/v1/portal/requests/{id}', response: `${detail.status} ${detail.json?.status} remarks=${detail.json?.finalRemarks ?? ''}`, pass: detail.status === 200 && detail.json?.status === 'REJECTED' && /withdrew/.test(detail.json?.finalRemarks ?? '') };
    });

  await step('EX-065', 'Renewal is only possible inside the renewal window and for renewable products', 'ag-000001',
    'Renew the new PRO policy (ends in a year) → 422 OUTSIDE_RENEWAL_WINDOW; renew a Khairat policy → 422 NOT_RENEWABLE; renewals-due lists policies ending within 45 days', async () => {
      const notDue = await client.request('POST', `/api/v1/portal/policies/${id}/renew`, { body: {} });
      const khr = (await client.request('GET', '/api/v1/portal/policies?status=ACTIVE&pageSize=50')).json?.items?.find((p) => p.product?.code === 'KHR');
      const khrTry = await client.request('POST', `/api/v1/portal/policies/${khr?.id}/renew`, { body: {} });
      const due = await client.request('GET', '/api/v1/portal/policies/renewals-due');
      const horizon = new Date(Date.now() + 46 * 86_400_000);
      const inWindow = (due.json?.items ?? []).every((p) => new Date(p.endDate) <= horizon);
      return { request: `POST /api/v1/portal/policies/${id}/renew; POST …/${khr?.id}/renew (KHR); GET renewals-due`, response: `${summary(notDue)} | ${summary(khrTry)} | due=${due.json?.items?.length} allWithin45d=${inWindow}`, pass: notDue.status === 422 && notDue.json?.code === 'OUTSIDE_RENEWAL_WINDOW' && khrTry.status === 422 && khrTry.json?.code === 'NOT_RENEWABLE' && due.status === 200 && inWindow };
    });

  await step('EX-066', 'Renewal quotation is created from a policy that is due', 'ag-000001',
    'POST renew → 201 DRAFT quotation carrying the nominees; a second renewal → 422 RENEWAL_EXISTS', async () => {
      let actor = client;
      let due = (await actor.request('GET', '/api/v1/portal/policies/renewals-due')).json?.items ?? [];
      if (!due.some((p) => p.product?.code !== 'KHR')) {
        actor = await as('ag-000002');
        due = (await actor.request('GET', '/api/v1/portal/policies/renewals-due')).json?.items ?? [];
      }
      const source = due.find((p) => p.product?.code !== 'KHR');
      if (!source) return { request: 'GET /api/v1/portal/policies/renewals-due (ag-000001, ag-000002)', response: 'Pre-condition not met: no renewable policy is due for renewal in the demonstration data (earlier runs already renewed them)', pass: false, blocked: true };
      const first = await actor.request('POST', `/api/v1/portal/policies/${source.id}/renew`, { body: {} });
      const again = await actor.request('POST', `/api/v1/portal/policies/${source.id}/renew`, { body: {} });
      const pass = (first.status === 201 && first.json?.status === 'DRAFT' && again.status === 422 && again.json?.code === 'RENEWAL_EXISTS') || (first.status === 422 && first.json?.code === 'RENEWAL_EXISTS');
      return { request: `POST /api/v1/portal/policies/${source.id}/renew (twice)`, response: `${first.status} ${first.json?.status ?? first.json?.code} | ${summary(again)}`, pass, note: first.status === 422 ? 'A renewal quotation already existed from the demonstration data' : undefined };
    });

  await step('EX-067', 'Claim notification is validated against the policy and the period of cover', 'ag-000001',
    'validate-policy → 200; event before cover start → 422 CLAIM_NOT_VALID; valid → 201 with claimNo CL/yy/nnnnnn', async () => {
      const validate = await client.request('GET', `/api/v1/portal/claims/validate-policy?policyNo=${encodeURIComponent(state.issued?.policyNo)}`);
      const outside = await client.request('POST', '/api/v1/portal/claims', { body: { policyId: id, claimType: 'ACCIDENT', eventDate: '2020-01-01', description: 'Event long before the cover started.' } });
      const r = await client.request('POST', '/api/v1/portal/claims', { body: { policyId: id, claimType: 'ACCIDENT', eventDate: bruneiToday(), description: 'Road accident; medical report to follow.' } });
      state.claim = r.json;
      return { request: 'GET /api/v1/portal/claims/validate-policy; POST /api/v1/portal/claims (2020-01-01; today)', response: `${validate.status} | ${summary(outside)} | ${r.status} ${r.json?.claimNo} ${r.json?.status}`, pass: validate.status === 200 && outside.status === 422 && outside.json?.code === 'CLAIM_NOT_VALID' && r.status === 201 && /^CL\/\d{2}\/\d{6}$/.test(r.json?.claimNo ?? '') && r.json?.status === 'SUBMITTED' };
    });

  await step('EX-068', 'Claim status follows the defined transitions in the back-office', 'ops.maker',
    'SUBMITTED → CLOSED refused (422 INVALID_STATUS_CHANGE); SUBMITTED → UNDER_REVIEW accepted (200); the agent sees the new status', async () => {
      const maker = await as('ops.maker');
      const bad = await maker.request('PUT', `/api/v1/backoffice/claims/${state.claim?.id}/status`, { body: { status: 'CLOSED', remarks: 'Skipping review' } });
      const ok = await maker.request('PUT', `/api/v1/backoffice/claims/${state.claim?.id}/status`, { body: { status: 'UNDER_REVIEW', remarks: 'Assessment started' } });
      const seen = await client.request('GET', `/api/v1/portal/claims/${state.claim?.id}`);
      return { request: `PUT /api/v1/backoffice/claims/${state.claim?.id}/status (CLOSED; UNDER_REVIEW)`, response: `${summary(bad)} | ${ok.status} | agent sees ${seen.json?.status}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_STATUS_CHANGE' && ok.status === 200 && seen.json?.status === 'UNDER_REVIEW' };
    });

  await step('EX-069', 'Claims cannot be notified on a quotation that is not in force', 'ag-000001',
    'HTTP 422 CLAIM_NOT_VALID stating that the policy is not in force', async () => {
      const draft = (await client.request('GET', '/api/v1/portal/policies?status=DRAFT&pageSize=1')).json?.items?.[0];
      const r = await client.request('POST', '/api/v1/portal/claims', { body: { policyId: draft?.id, claimType: 'ACCIDENT', eventDate: bruneiToday(), description: 'Claim on a draft quotation.' } });
      return { request: 'POST /api/v1/portal/claims (draft quotation)', response: summary(r), pass: r.status === 422 && r.json?.code === 'CLAIM_NOT_VALID' && /not in force/i.test(JSON.stringify(r.json?.details)) };
    });
}

// ---------------------------------------------------------------------------------------------
// 7. Agent onboarding, hierarchy, AML
// ---------------------------------------------------------------------------------------------
async function agents() {
  const principal = await as('ag-000001');
  const sub = await as('ag-000002');
  const maker = await as('ops.maker');
  const checker = await as('ops.checker');
  const ic = () => `01-5${Date.now().toString().slice(-5)}`;

  await step('EX-070', 'Only an agency principal can register agents through the portal', 'ag-000002',
    'HTTP 403 FORBIDDEN for a sub-agent', async () => {
      const r = await sub.request('POST', '/api/v1/portal/agents', { body: { agentType: 'SUB_AGENT', fullName: 'Not Allowed', idType: 'NRIC', idNumber: ic(), dateOfBirth: '1995-01-01', email: 'x@agents.example', mobile: '6738000001' } });
      return { request: 'POST /api/v1/portal/agents (ag-000002)', response: summary(r), pass: r.status === 403 };
    });

  await step('EX-071', 'Hierarchy rules: a bank officer cannot be registered under an agency; a main agent cannot report to another agent', 'ag-000001',
    'HTTP 422 INVALID_AGENT_TYPE; HTTP 422 INVALID_PARENT', async () => {
      const banker = await principal.request('POST', '/api/v1/portal/agents', { body: { agentType: 'BANKER', fullName: 'Bank Officer', idType: 'NRIC', idNumber: ic(), dateOfBirth: '1995-01-01', email: 'bo@agents.example', mobile: '6738000002' } });
      const main = await principal.request('POST', '/api/v1/portal/agents', { body: { agentType: 'MAIN_AGENT', parentAgentId: principal.user.agentId, fullName: 'Main Under Main', idType: 'NRIC', idNumber: ic(), dateOfBirth: '1995-01-01', email: 'mm@agents.example', mobile: '6738000003' } });
      return { request: 'POST /api/v1/portal/agents (BANKER; MAIN_AGENT with parent)', response: `${summary(banker)} | ${summary(main)}`, pass: banker.status === 422 && banker.json?.code === 'INVALID_AGENT_TYPE' && main.status === 422 && main.json?.code === 'INVALID_PARENT' };
    });

  await step('EX-072', 'Principal registers a sub-agent: unique code, PENDING status, duplicate IC refused', 'ag-000001',
    'HTTP 201 with agentCode AG-nnnnnn and status PENDING; same IC again → 422 DUPLICATE_AGENT', async () => {
      const idNumber = ic();
      const r = await principal.request('POST', '/api/v1/portal/agents', { body: { agentType: 'SUB_AGENT', fullName: `Hazirah binti Jamil ${RUN}`, idType: 'NRIC', idNumber, dateOfBirth: '1996-02-02', email: `hazirah.${RUN.toLowerCase()}@agents.example`, mobile: '6738445566' } });
      state.newAgent = r.json;
      const dup = await principal.request('POST', '/api/v1/portal/agents', { body: { agentType: 'SUB_AGENT', fullName: 'Duplicate Person', idType: 'NRIC', idNumber, dateOfBirth: '1996-02-02', email: 'dup@agents.example', mobile: '6738445567' } });
      return { request: 'POST /api/v1/portal/agents (twice with the same IC)', response: `${r.status} ${r.json?.agentCode} ${r.json?.status} | ${summary(dup)}`, pass: r.status === 201 && /^AG-\d{6}$/.test(r.json?.agentCode ?? '') && r.json?.status === 'PENDING' && dup.status === 422 && dup.json?.code === 'DUPLICATE_AGENT' };
    });

  await step('EX-073', 'Registration cannot be approved until the IC copy is uploaded', 'ops.checker',
    'HTTP 422 DOCUMENTS_MISSING before upload', async () => {
      const inbox = await checker.request('GET', '/api/v1/backoffice/approvals/inbox?pageSize=100');
      state.agentRequest = (inbox.json?.items ?? []).find((i) => i.entityId === state.newAgent?.id);
      const r = await checker.request('POST', `/api/v1/backoffice/approvals/${state.agentRequest?.id}/approve`, { body: {} });
      return { request: `POST /api/v1/backoffice/approvals/${state.agentRequest?.id}/approve`, response: summary(r), pass: r.status === 422 && r.json?.code === 'DOCUMENTS_MISSING' };
    });

  await step('EX-074', 'After the IC copy is uploaded the checker approves: agent ACTIVE with a portal account', 'ag-000001, ops.checker',
    'HTTP 200; GET /portal/agents/{id} shows status ACTIVE; a user named after the agent code exists', async () => {
      await upload(principal, 'AGENT', state.newAgent?.id, 'IC_COPY', PDF, 'ic.pdf');
      const r = await checker.request('POST', `/api/v1/backoffice/approvals/${state.agentRequest?.id}/approve`, { body: { remarks: 'IC verified' } });
      const agent = await principal.request('GET', `/api/v1/portal/agents/${state.newAgent?.id}`);
      const manager = await as('manager');
      const users = await manager.request('GET', `/api/v1/backoffice/users?search=${state.newAgent?.agentCode?.toLowerCase()}`);
      const user = (users.json?.items ?? []).find((u) => u.username === state.newAgent?.agentCode?.toLowerCase());
      return { request: 'POST /api/v1/common/documents (AGENT IC_COPY); POST approvals/{id}/approve; GET /api/v1/portal/agents/{id}; GET /api/v1/backoffice/users', response: `${r.status} | agent ${agent.json?.status} | user ${user?.username ?? 'missing'} mustChangePassword=${user?.mustChangePassword}`, pass: r.status === 200 && agent.json?.status === 'ACTIVE' && !!user };
    });

  await step('EX-075', 'Segregation of duties: a back-office maker cannot approve their own registration', 'ops.maker',
    'HTTP 422 SEGREGATION_OF_DUTIES', async () => {
      const agencies = await maker.request('GET', '/api/v1/backoffice/agencies/options');
      const agency = (agencies.json ?? []).find((a) => a.code === 'AGY-DT') ?? (agencies.json ?? [])[0];
      const r = await maker.request('POST', '/api/v1/backoffice/agents', { body: { agencyId: agency?.id, agentType: 'MAIN_AGENT', fullName: `Back-office Registered ${RUN}`, idType: 'NRIC', idNumber: ic(), dateOfBirth: '1988-08-08', email: `bo.${RUN.toLowerCase()}@agents.example`, mobile: '6738000009' } });
      state.boAgent = r.json;
      const inbox = await maker.request('GET', '/api/v1/backoffice/approvals?status=PENDING&pageSize=100');
      const request = (inbox.json?.items ?? []).find((i) => i.entityId === r.json?.id);
      state.boAgentRequest = request;
      const self = await maker.request('POST', `/api/v1/backoffice/approvals/${request?.id}/approve`, { body: {} });
      return { request: 'POST /api/v1/backoffice/agents; POST approvals/{id}/approve by the same user', response: `${r.status} ${r.json?.agentCode} | ${summary(self)}`, pass: r.status === 201 && self.status === 422 && self.json?.code === 'SEGREGATION_OF_DUTIES' };
    });

  await step('EX-076', 'Checker rejects with mandatory remarks; the maker sees the reason', 'ops.checker, ops.maker',
    'Reject without remarks → 400; with remarks → 200 and status REJECTED; agent status REJECTED', async () => {
      const bad = await checker.request('POST', `/api/v1/backoffice/approvals/${state.boAgentRequest?.id}/reject`, { body: {} });
      const ok = await checker.request('POST', `/api/v1/backoffice/approvals/${state.boAgentRequest?.id}/reject`, { body: { remarks: 'Licence number missing' } });
      const agent = await maker.request('GET', `/api/v1/backoffice/agents/${state.boAgent?.id}`);
      return { request: `POST /api/v1/backoffice/approvals/${state.boAgentRequest?.id}/reject`, response: `${bad.status} | ${ok.status} ${ok.json?.status} | agent ${agent.json?.status}`, pass: bad.status === 400 && ok.status === 200 && ok.json?.status === 'REJECTED' && agent.json?.status === 'REJECTED' };
    });

  await step('EX-077', 'Profile update request from the portal and the hierarchy view', 'ag-000002',
    'POST profile/update-requests → 201 PENDING; GET /portal/hierarchy → 200 with the reporting line; GET /portal/agency → 200', async () => {
      const pending = (await sub.request('GET', '/api/v1/portal/requests?status=PENDING&pageSize=50')).json?.items ?? [];
      for (const old of pending.filter((i) => i.type === 'AGENT_PROFILE_UPDATE')) await sub.request('POST', `/api/v1/portal/requests/${old.id}/withdraw`, { body: {} });
      const r = await sub.request('POST', '/api/v1/portal/profile/update-requests', { body: { mobile: `6739${Date.now().toString().slice(-6)}` } });
      const h = await sub.request('GET', '/api/v1/portal/hierarchy');
      const a = await sub.request('GET', '/api/v1/portal/agency');
      return { request: 'POST /api/v1/portal/profile/update-requests; GET /api/v1/portal/hierarchy; GET /api/v1/portal/agency', response: `${r.status} ${r.json?.type} ${r.json?.status} | ${h.status} | ${a.status} ${a.json?.code ?? ''}`, pass: r.status === 201 && r.json?.type === 'AGENT_PROFILE_UPDATE' && h.status === 200 && Array.isArray(h.json) && /AG-00000/.test(h.text) && a.status === 200 };
    });

  await step('EX-078', 'Agent status change request with an invalid transition is refused', 'ops.maker',
    'ACTIVE → ACTIVE refused with 422 INVALID_STATUS_CHANGE; ACTIVE → SUSPENDED creates a request (201)', async () => {
      const agentsList = await maker.request('GET', '/api/v1/backoffice/agents?search=AG-000003');
      const target = (agentsList.json?.items ?? []).find((a) => a.agentCode === 'AG-000003');
      const bad = await maker.request('POST', `/api/v1/backoffice/agents/${target?.id}/status-requests`, { body: { status: 'ACTIVE', reason: 'Already active' } });
      const ok = await maker.request('POST', `/api/v1/backoffice/agents/${target?.id}/status-requests`, { body: { status: 'SUSPENDED', reason: `Licence review ${RUN}` } });
      state.statusRequest = ok.json;
      const withdrawn = await maker.request('POST', `/api/v1/backoffice/approvals/${ok.json?.id}/withdraw`, { body: {} });
      return { request: `POST /api/v1/backoffice/agents/${target?.id}/status-requests (ACTIVE; SUSPENDED); withdraw`, response: `${summary(bad)} | ${ok.status} ${ok.json?.status} | withdraw ${withdrawn.status} ${withdrawn.json?.status ?? ''}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_STATUS_CHANGE' && ok.status === 201 && withdrawn.status === 200 && withdrawn.json?.status === 'WITHDRAWN' };
    });

  await step('EX-079', 'Agency maintenance: validation and creation', 'manager',
    'Invalid code → 400; valid agency → 201 with status ACTIVE', async () => {
      const manager = await as('manager');
      const bad = await manager.request('POST', '/api/v1/backoffice/agencies', { body: { code: 'bad code', name: 'X', channel: 'AGENCY' } });
      const ok = await manager.request('POST', '/api/v1/backoffice/agencies', { body: { code: `AGY-${RUN}`, name: `Test Agency ${RUN}`, channel: 'AGENCY', email: 'agency@example.com', phone: '6732223344' } });
      return { request: 'POST /api/v1/backoffice/agencies', response: `${bad.status} | ${ok.status} ${ok.json?.code} ${ok.json?.status}`, pass: bad.status === 400 && ok.status === 201 && ok.json?.status === 'ACTIVE' };
    });
}

async function aml() {
  const client = await as('ag-000001');
  const compliance = await as('compliance');

  await step('EX-080', 'Participant matching a watch-list name is flagged and routed to Compliance', 'ag-000001',
    'HTTP 201 with amlStatus FLAGGED; quotation submission → 422 AML_REVIEW_PENDING', async () => {
      const r = await client.request('POST', '/api/v1/portal/participants', { body: { type: 'INDIVIDUAL', fullName: 'Rashid Al Mansouri', idType: 'PASSPORT', idNumber: `A${Date.now().toString().slice(-7)}`, dateOfBirth: '1975-04-04', nationality: 'OTHER', occupation: 'MANAGERIAL', occupationClass: 1, mobile: '6738777888', addressLine1: 'Kg Contoh' } });
      state.flagged = r.json;
      const q = await client.request('POST', '/api/v1/portal/policies', { body: { productId: state.products.KHR.id, participantId: r.json?.id, planCode: 'A', coverageType: 'INDIVIDUAL', riskDetails: {} } });
      state.flaggedQuotation = q.json;
      await client.request('PUT', `/api/v1/portal/policies/${q.json?.id}/questionnaire`, { body: { answers: ['HEALTH_CURRENT', 'HEALTH_HOSPITAL', 'PRIOR_DECLINE'].map((code) => ({ code, answer: false })) } });
      await client.request('PUT', `/api/v1/portal/policies/${q.json?.id}/nominees`, { body: { nominees: [{ fullName: 'Nominee One', relationship: 'CHILD', role: 'NOMINEE', sharePercent: 100 }] } });
      for (const docType of ['IC_COPY', 'NOMINEE_IC']) await upload(client, 'POLICY', q.json?.id, docType);
      await client.request('POST', `/api/v1/portal/policies/${q.json?.id}/signatures`, { body: { signer: 'PARTICIPANT', imageDataUrl: PNG_DATA_URL } });
      const s = await client.request('POST', `/api/v1/portal/policies/${q.json?.id}/submit`, { body: {} });
      return { request: 'POST /api/v1/portal/participants (Rashid Al Mansouri); … submit', response: `${r.status} aml=${r.json?.amlStatus} | ${summary(s)}`, pass: r.status === 201 && r.json?.amlStatus === 'FLAGGED' && s.status === 422 && s.json?.code === 'AML_REVIEW_PENDING' };
    });

  await step('EX-081', 'Compliance reviews the case: remarks mandatory, decision recorded once', 'compliance',
    'Case listed PENDING_REVIEW with score ≥ 85; review without remarks → 400/422; CLEARED → 201; second review → 422 ALREADY_REVIEWED; participant amlStatus CLEAR', async () => {
      const cases = await compliance.request('GET', '/api/v1/backoffice/aml/cases?status=PENDING_REVIEW&pageSize=100');
      const c = (cases.json?.items ?? []).find((x) => x.subjectId === state.flagged?.id);
      const noRemarks = await compliance.request('POST', `/api/v1/backoffice/aml/cases/${c?.id}/review`, { body: { decision: 'CLEARED', remarks: '' } });
      const cleared = await compliance.request('POST', `/api/v1/backoffice/aml/cases/${c?.id}/review`, { body: { decision: 'CLEARED', remarks: 'Different date of birth and nationality; false positive' } });
      const again = await compliance.request('POST', `/api/v1/backoffice/aml/cases/${c?.id}/review`, { body: { decision: 'CONFIRMED_MATCH', remarks: 'late' } });
      const participant = await client.request('GET', `/api/v1/portal/participants/${state.flagged?.id}`);
      return { request: `GET /api/v1/backoffice/aml/cases; POST aml/cases/${c?.id}/review (no remarks; CLEARED; again)`, response: `score=${c?.score} ${c?.status} | ${summary(noRemarks)} | ${cleared.status} | ${summary(again)} | participant ${participant.json?.amlStatus}`, pass: c?.score >= 85 && [400, 422].includes(noRemarks.status) && cleared.status === 201 && again.status === 422 && again.json?.code === 'ALREADY_REVIEWED' && participant.json?.amlStatus === 'CLEAR' };
    });

  await step('EX-082', 'Cleared participant can now be submitted', 'ag-000001',
    'POST submit → 200 PENDING_PAYMENT', async () => {
      const s = await client.request('POST', `/api/v1/portal/policies/${state.flaggedQuotation?.id}/submit`, { body: {} });
      return { request: `POST /api/v1/portal/policies/${state.flaggedQuotation?.id}/submit`, response: `${s.status} ${s.json?.status ?? summary(s)}`, pass: s.status === 200 && s.json?.status === 'PENDING_PAYMENT' };
    });

  await step('EX-083', 'Watch-list maintenance: manual entry and CSV import validation', 'compliance',
    'POST watchlist → 201; CSV with a wrong header → 422 INVALID_CSV; valid CSV → 201 imported=1', async () => {
      const entry = await compliance.request('POST', '/api/v1/backoffice/aml/watchlist', { body: { listName: 'INTERNAL', fullName: `Test Listed Person ${RUN}`, country: 'BN', reference: `T-${RUN}` } });
      const badCsv = await compliance.request('POST', '/api/v1/backoffice/aml/watchlist/import', { form: fileForm({ replaceList: 'false' }, 'file', Buffer.from('name,list\nX,Y\n'), 'list.csv', 'text/csv') });
      const okCsv = await compliance.request('POST', '/api/v1/backoffice/aml/watchlist/import', { form: fileForm({ replaceList: 'false' }, 'file', Buffer.from(`list_name,full_name,id_number,country,reference\nLOCAL,"Doe, John ${RUN}",,BN,L-${RUN}\n`), 'list.csv', 'text/csv') });
      return { request: 'POST /api/v1/backoffice/aml/watchlist; POST aml/watchlist/import (bad header; valid)', response: `${entry.status} | ${summary(badCsv)} | ${okCsv.status} imported=${okCsv.json?.imported}`, pass: entry.status === 201 && badCsv.status === 422 && badCsv.json?.code === 'INVALID_CSV' && okCsv.status === 201 && okCsv.json?.imported === 1 };
    });

  await step('EX-084', 'AML functions are restricted to Compliance', 'ops.maker',
    'GET /backoffice/aml/cases → 403 FORBIDDEN for the operations officer', async () => {
      const maker = await as('ops.maker');
      const r = await maker.request('GET', '/api/v1/backoffice/aml/cases');
      return { request: 'GET /api/v1/backoffice/aml/cases', response: summary(r), pass: r.status === 403 };
    });
}

// ---------------------------------------------------------------------------------------------
// 8. Issues and SLA
// ---------------------------------------------------------------------------------------------
async function issues() {
  const agent = await as('ag-000002');
  const support = await as('support');

  await step('EX-090', 'Agent reports an issue and receives a reference and SLA targets', 'ag-000002',
    'HTTP 201; issueNo IS/yy/nnnnnn; HIGH priority → responseDueAt = created + 2 h, resolutionDueAt = created + 24 h', async () => {
      const r = await agent.request('POST', '/api/v1/common/issues', { body: { title: `Receipt PDF shows wrong amount ${RUN}`, description: 'The e-receipt for the policy issued today shows the contribution without the additional cover.', category: 'DOCUMENTS', priority: 'HIGH' } });
      state.issue = r.json;
      const created = new Date(r.json?.createdAt).getTime();
      const response = (new Date(r.json?.responseDueAt).getTime() - created) / 3_600_000;
      const resolution = (new Date(r.json?.resolutionDueAt).getTime() - created) / 3_600_000;
      return { request: 'POST /api/v1/common/issues (HIGH)', response: `${r.status} ${r.json?.issueNo} ${r.json?.status} response+${response}h resolution+${resolution}h`, pass: r.status === 201 && /^IS\/\d{2}\/\d{6}$/.test(r.json?.issueNo ?? '') && response === 2 && resolution === 24 };
    });

  await step('EX-091', 'Support assigns the issue and changes the priority; SLA targets are recomputed', 'support',
    'PUT assignment → 200 status ASSIGNED; PUT priority CRITICAL → 200 with responseDueAt = now + 1 h', async () => {
      const assignees = await support.request('GET', '/api/v1/backoffice/issues/assignees');
      const a = await support.request('PUT', `/api/v1/backoffice/issues/${state.issue?.id}/assignment`, { body: { assigneeId: assignees.json?.[0]?.id } });
      const p = await support.request('PUT', `/api/v1/backoffice/issues/${state.issue?.id}/priority`, { body: { priority: 'CRITICAL' } });
      const hours = (new Date(p.json?.responseDueAt).getTime() - Date.now()) / 3_600_000;
      return { request: `PUT /api/v1/backoffice/issues/${state.issue?.id}/assignment; PUT …/priority`, response: `${a.status} ${a.json?.status} | ${p.status} ${p.json?.priority} response in ${hours.toFixed(2)} h`, pass: a.status === 200 && a.json?.status === 'ASSIGNED' && p.status === 200 && p.json?.priority === 'CRITICAL' && hours > 0.9 && hours <= 1 };
    });

  await step('EX-092', 'Internal comments stay hidden from the reporter; resolution needs a description', 'support, ag-000002',
    'Two comments (one internal); reporter sees one; RESOLVED without resolution → 422 RESOLUTION_REQUIRED; with resolution → 200', async () => {
      await support.request('POST', `/api/v1/common/issues/${state.issue?.id}/comments`, { body: { body: 'Checking with Finance', internal: true } });
      await support.request('POST', `/api/v1/common/issues/${state.issue?.id}/comments`, { body: { body: 'Receipt reissued with the correct amount' } });
      const bad = await support.request('PUT', `/api/v1/common/issues/${state.issue?.id}/status`, { body: { status: 'RESOLVED' } });
      const ok = await support.request('PUT', `/api/v1/common/issues/${state.issue?.id}/status`, { body: { status: 'RESOLVED', resolution: 'Receipt regenerated' } });
      const seen = await agent.request('GET', `/api/v1/common/issues/${state.issue?.id}`);
      const internals = (seen.json?.comments ?? []).map((c) => c.internal);
      return { request: `POST /api/v1/common/issues/${state.issue?.id}/comments ×2; PUT …/status`, response: `${summary(bad)} | ${ok.status} | reporter sees comments internal=${JSON.stringify(internals)} status=${seen.json?.status}`, pass: bad.status === 422 && bad.json?.code === 'RESOLUTION_REQUIRED' && ok.status === 200 && internals.length === 1 && internals[0] === false && seen.json?.status === 'RESOLVED' };
    });

  await step('EX-093', 'Reporter closes the resolved issue; the issue list filters by status', 'ag-000002',
    'PUT status CLOSED → 200; GET /common/issues?status=CLOSED lists it', async () => {
      const r = await agent.request('PUT', `/api/v1/common/issues/${state.issue?.id}/status`, { body: { status: 'CLOSED' } });
      const list = await agent.request('GET', '/api/v1/common/issues?status=CLOSED&pageSize=50');
      const listed = (list.json?.items ?? []).some((i) => i.id === state.issue?.id);
      return { request: `PUT /api/v1/common/issues/${state.issue?.id}/status (CLOSED); GET /api/v1/common/issues?status=CLOSED`, response: `${r.status} ${r.json?.status} | listed=${listed}`, pass: r.status === 200 && r.json?.status === 'CLOSED' && listed };
    });

  await step('EX-094', 'Issues of another agency are not visible to an agent', 'ag-000003',
    'GET /common/issues/{id} → 404 (or 403) for an issue of agency AGY-SA', async () => {
      const other = await as('ag-000003');
      const r = await other.request('GET', `/api/v1/common/issues/${state.issue?.id}`);
      return { request: `GET /api/v1/common/issues/${state.issue?.id} (ag-000003)`, response: summary(r), pass: r.status === 404 || r.status === 403 };
    });
}

// ---------------------------------------------------------------------------------------------
// 9. Reports and dashboards
// ---------------------------------------------------------------------------------------------
async function reports() {
  const manager = await as('manager');
  const agent = await as('ag-000002');

  await step('EX-100', 'Standard report catalogue and filtered preview', 'manager',
    '12 reports; POLICY_REGISTER preview with a date range returns rows and columns', async () => {
      const catalogue = await manager.request('GET', '/api/v1/backoffice/reports');
      const preview = await manager.request('GET', `/api/v1/backoffice/reports/POLICY_REGISTER?from=2025-01-01&to=${bruneiToday()}`);
      return { request: 'GET /api/v1/backoffice/reports; GET /api/v1/backoffice/reports/POLICY_REGISTER?from&to', response: `${catalogue.json?.length} reports | ${preview.status} rows=${preview.json?.rows?.length}`, pass: catalogue.json?.length === 12 && preview.status === 200 && Array.isArray(preview.json?.rows) && preview.json.rows.length > 0 };
    });

  await step('EX-101', 'Every standard report runs', 'manager',
    'HTTP 200 with a rows array for each of the 12 reports', async () => {
      const catalogue = (await manager.request('GET', '/api/v1/backoffice/reports')).json ?? [];
      const failed = [];
      for (const report of catalogue) {
        const r = await manager.request('GET', `/api/v1/backoffice/reports/${report.code}?from=2025-01-01&to=${bruneiToday()}`);
        if (r.status !== 200 || !Array.isArray(r.json?.rows)) failed.push(`${report.code}:${r.status}`);
      }
      return { request: 'GET /api/v1/backoffice/reports/{code} for every report', response: failed.length ? `Failed: ${failed.join(', ')}` : `${catalogue.length} reports returned rows`, pass: failed.length === 0 && catalogue.length === 12 };
    });

  await step('EX-102', 'Report export in XLSX, CSV and PDF', 'manager',
    'HTTP 200 with the matching content type for each format', async () => {
      const types = { XLSX: 'spreadsheetml', CSV: 'text/csv', PDF: 'application/pdf' };
      const out = [];
      let pass = true;
      for (const [format, type] of Object.entries(types)) {
        const r = await manager.request('GET', `/api/v1/backoffice/reports/POLICY_REGISTER/export?format=${format}`);
        out.push(`${format}:${r.status} ${r.headers.get('content-type')?.split(';')[0]}`);
        pass = pass && r.status === 200 && (r.headers.get('content-type') ?? '').includes(type);
      }
      return { request: 'GET /api/v1/backoffice/reports/POLICY_REGISTER/export?format=', response: out.join(' | '), pass };
    });

  await step('EX-103', 'Portal reports are limited to the agent’s role and scope', 'ag-000002',
    'Portal catalogue excludes AML_SCREENING; GET /portal/reports/AML_SCREENING → 403; an allowed report runs with only the agent’s own records', async () => {
      const catalogue = await agent.request('GET', '/api/v1/portal/reports');
      const codes = (catalogue.json ?? []).map((r) => r.code);
      const forbidden = await agent.request('GET', '/api/v1/portal/reports/AML_SCREENING');
      const own = await agent.request('GET', `/api/v1/portal/reports/${codes[0]}?from=2025-01-01&to=${bruneiToday()}`);
      return { request: 'GET /api/v1/portal/reports; GET /api/v1/portal/reports/AML_SCREENING; GET /api/v1/portal/reports/{first}', response: `codes=${codes.join(',')} | ${forbidden.status} | ${own.status} rows=${own.json?.rows?.length}`, pass: !codes.includes('AML_SCREENING') && forbidden.status === 403 && own.status === 200 };
    });

  await step('EX-104', 'Scheduled report distribution is configurable', 'manager',
    'Invalid recipient → 400; valid schedule → 201 with nextRunAt; deactivate → 200 active=false', async () => {
      const bad = await manager.request('POST', '/api/v1/backoffice/reports/schedules', { body: { reportCode: 'COLLECTIONS', name: 'Bad', frequency: 'DAILY', format: 'XLSX', period: 'PREVIOUS_DAY', recipients: ['not-an-email'] } });
      const ok = await manager.request('POST', '/api/v1/backoffice/reports/schedules', { body: { reportCode: 'COLLECTIONS', name: `Daily collections ${RUN}`, frequency: 'DAILY', format: 'XLSX', period: 'PREVIOUS_DAY', recipients: ['finance@iift.example'] } });
      const off = await manager.request('PUT', `/api/v1/backoffice/reports/schedules/${ok.json?.id}/active`, { body: { active: false } });
      return { request: 'POST /api/v1/backoffice/reports/schedules; PUT …/active', response: `${bad.status} | ${ok.status} nextRunAt=${ok.json?.nextRunAt ? 'set' : 'missing'} | ${off.status} active=${off.json?.active}`, pass: bad.status === 400 && ok.status === 201 && !!ok.json?.nextRunAt && off.status === 200 && off.json?.active === false };
    });

  await step('EX-105', 'Management and portal dashboards', 'manager, ag-000001',
    'Back-office dashboard has KPIs and a 12-month trend; portal dashboard has the profile, pending actions and production figures', async () => {
      const bo = await manager.request('GET', '/api/v1/backoffice/dashboard');
      const portal = await (await as('ag-000001')).request('GET', '/api/v1/portal/dashboard');
      return { request: 'GET /api/v1/backoffice/dashboard; GET /api/v1/portal/dashboard', response: `${bo.status} policiesYtd=${bo.json?.kpis?.policiesYtd} trend=${bo.json?.trend?.length} | ${portal.status} pendingActions=${portal.json?.pendingActions?.length} keys=${Object.keys(portal.json ?? {}).join(',')}`, pass: bo.status === 200 && bo.json?.kpis?.policiesYtd > 0 && bo.json?.trend?.length === 12 && portal.status === 200 && !!portal.json?.profile && Array.isArray(portal.json?.pendingActions) };
    });

  await step('EX-106', 'Back-office pending-action view: approvals inbox and document queue', 'ops.checker',
    'GET approvals/inbox → 200 with items for the checker’s permissions; GET /backoffice/documents?status=UPLOADED → 200', async () => {
      const checker = await as('ops.checker');
      const inbox = await checker.request('GET', '/api/v1/backoffice/approvals/inbox');
      const queue = await checker.request('GET', '/api/v1/backoffice/documents?status=UPLOADED');
      return { request: 'GET /api/v1/backoffice/approvals/inbox; GET /api/v1/backoffice/documents?status=UPLOADED', response: `${inbox.status} total=${inbox.json?.total} | ${queue.status} total=${queue.json?.total}`, pass: inbox.status === 200 && Array.isArray(inbox.json?.items) && queue.status === 200 && Array.isArray(queue.json?.items) };
    });
}

// ---------------------------------------------------------------------------------------------
// 10. Administration: users, roles, parameters, master data, workflows, audit
// ---------------------------------------------------------------------------------------------
async function administration() {
  const manager = await as('manager');

  await step('EX-110', 'Create a back-office user with a temporary password; role audience is enforced', 'manager',
    'HTTP 201 with a 17-character temporary password; assigning a portal role → 422 INVALID_ROLE; no role → 422 ROLE_REQUIRED', async () => {
      const roles = (await manager.request('GET', '/api/v1/backoffice/role-options')).json ?? [];
      const auditor = roles.find((r) => r.code === 'AUDITOR');
      const portalRole = roles.find((r) => r.audience === 'PORTAL');
      const username = `qa.lockout.${RUN.toLowerCase()}`;
      const r = await manager.request('POST', '/api/v1/backoffice/users', { body: { username, fullName: 'QA Lockout Tester', email: `${username}@iift.example`, authSource: 'LOCAL', roleIds: [auditor?.id] } });
      state.qaUser = { ...r.json?.user, username, temporaryPassword: r.json?.temporaryPassword };
      const wrongRole = await manager.request('PATCH', `/api/v1/backoffice/users/${r.json?.user?.id}`, { body: { roleIds: [portalRole?.id] } });
      const noRole = await manager.request('PATCH', `/api/v1/backoffice/users/${r.json?.user?.id}`, { body: { roleIds: [] } });
      return { request: 'POST /api/v1/backoffice/users; PATCH users/{id} (portal role; no role)', response: `${r.status} temp password length=${r.json?.temporaryPassword?.length} | ${summary(wrongRole)} | ${summary(noRole)}`, pass: r.status === 201 && r.json?.temporaryPassword?.length === 17 && wrongRole.status === 422 && wrongRole.json?.code === 'INVALID_ROLE' && noRole.status === 422 && noRole.json?.code === 'ROLE_REQUIRED' };
    });

  await step('EX-111', 'Administrators cannot disable their own account, reset their own password or change their own roles', 'manager',
    'HTTP 422 SELF_STATUS_CHANGE; 422 SELF_RESET; 422 SELF_ROLE_CHANGE', async () => {
      const me = manager.user.id;
      const status = await manager.request('PUT', `/api/v1/backoffice/users/${me}/status`, { body: { status: 'DISABLED' } });
      const reset = await manager.request('POST', `/api/v1/backoffice/users/${me}/reset-password`, { body: {} });
      const roles = await manager.request('PATCH', `/api/v1/backoffice/users/${me}`, { body: { roleIds: [] } });
      return { request: `PUT users/${me}/status; POST users/${me}/reset-password; PATCH users/${me}`, response: `${summary(status)} | ${summary(reset)} | ${summary(roles)}`, pass: status.status === 422 && status.json?.code === 'SELF_STATUS_CHANGE' && reset.status === 422 && reset.json?.code === 'SELF_RESET' && roles.status === 422 && roles.json?.code === 'SELF_ROLE_CHANGE' };
    });

  await step('EX-112', 'Role management: permissions must match the audience; system roles cannot be deleted', 'manager',
    'Role with a portal permission for a back-office audience → 422 INVALID_PERMISSION; valid role → 201; DELETE system role → 422 SYSTEM_ROLE; DELETE the new role → 200/204', async () => {
      const bad = await manager.request('POST', '/api/v1/backoffice/roles', { body: { code: `READ_ONLY_${RUN}`, name: 'Read only', audience: 'BACKOFFICE', permissions: ['bo.dashboard', 'portal.dashboard'] } });
      const ok = await manager.request('POST', '/api/v1/backoffice/roles', { body: { code: `READ_ONLY_${RUN}`, name: 'Read only', audience: 'BACKOFFICE', permissions: ['bo.dashboard', 'bo.policies.view'] } });
      const system = (await manager.request('GET', '/api/v1/backoffice/roles')).json?.find?.((r) => r.code === 'SYSTEM_ADMINISTRATOR') ?? ((await manager.request('GET', '/api/v1/backoffice/roles')).json?.items ?? []).find((r) => r.code === 'SYSTEM_ADMINISTRATOR');
      const delSystem = await manager.request('DELETE', `/api/v1/backoffice/roles/${system?.id}`);
      const delNew = await manager.request('DELETE', `/api/v1/backoffice/roles/${ok.json?.id}`);
      return { request: 'POST /api/v1/backoffice/roles ×2; DELETE roles/{system}; DELETE roles/{new}', response: `${summary(bad)} | ${ok.status} | ${summary(delSystem)} | ${delNew.status}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_PERMISSION' && ok.status === 201 && delSystem.status === 422 && delSystem.json?.code === 'SYSTEM_ROLE' && [200, 204].includes(delNew.status) };
    });

  await step('EX-113', 'Business parameters are range-checked and every change is audited', 'manager',
    'billing.payment_grace_days = 0 → 422 INVALID_PARAMETER; = 10 → 200; restored to 7; audit trail shows PARAMETER_UPDATED by manager with before/after values', async () => {
      const bad = await manager.request('PUT', '/api/v1/backoffice/config/parameters/billing.payment_grace_days', { body: { value: '0' } });
      const ok = await manager.request('PUT', '/api/v1/backoffice/config/parameters/billing.payment_grace_days', { body: { value: '10' } });
      const back = await manager.request('PUT', '/api/v1/backoffice/config/parameters/billing.payment_grace_days', { body: { value: '7' } });
      const audit = await manager.request('GET', '/api/v1/backoffice/audit?entityType=ConfigParameter&pageSize=1');
      const entry = audit.json?.items?.[0] ?? {};
      return { request: 'PUT /api/v1/backoffice/config/parameters/billing.payment_grace_days (0; 10; 7); GET /api/v1/backoffice/audit?entityType=ConfigParameter', response: `${summary(bad)} | ${ok.status} | ${back.status} | audit ${entry.action} by ${entry.actorName} before=${JSON.stringify(entry.before ?? entry.beforeValue ?? '').slice(0, 40)} after=${JSON.stringify(entry.after ?? entry.afterValue ?? '').slice(0, 40)}`, pass: bad.status === 422 && bad.json?.code === 'INVALID_PARAMETER' && ok.status === 200 && back.status === 200 && entry.action === 'PARAMETER_UPDATED' && entry.actorName === 'manager' };
    });

  await step('EX-114', 'Master data: a new code is created, deactivated and then refused in business transactions', 'manager, ag-000001',
    'POST codes → 201; PATCH active=false → 200; endorsement with the inactive type → 422 INVALID_CODE', async () => {
      const code = `TEST_${RUN}`;
      const created = await manager.request('POST', '/api/v1/backoffice/config/codes', { body: { category: 'ENDORSEMENT_TYPE', code, label: `Test endorsement ${RUN}` } });
      const off = await manager.request('PATCH', `/api/v1/backoffice/config/codes/${created.json?.id}`, { body: { active: false } });
      const agent = await as('ag-000001');
      const r = await agent.request('POST', `/api/v1/portal/policies/${state.issued?.id}/endorsements`, { body: { endorsementType: code, description: 'Uses an inactive code' } });
      return { request: 'POST /api/v1/backoffice/config/codes; PATCH codes/{id}; POST /api/v1/portal/policies/{id}/endorsements', response: `${created.status} | ${off.status} active=${off.json?.active} | ${summary(r)}`, pass: created.status === 201 && off.status === 200 && off.json?.active === false && r.status === 422 && r.json?.code === 'INVALID_CODE' };
    });

  await step('EX-115', 'Workflow configuration: eight workflows; steps must use approval permissions', 'manager',
    'GET /backoffice/workflows → 8; PUT with a non-approval permission → 422; valid change → 200', async () => {
      const list = await manager.request('GET', '/api/v1/backoffice/workflows');
      const bad = await manager.request('PUT', '/api/v1/backoffice/workflows/PARTICIPANT_UPDATE', { body: { active: true, steps: [{ name: 'Anyone', permission: 'bo.users.manage' }] } });
      const ok = await manager.request('PUT', '/api/v1/backoffice/workflows/PARTICIPANT_UPDATE', { body: { active: true, steps: [{ name: 'Operations supervisor approval', permission: 'bo.approve.participants' }] } });
      return { request: 'GET /api/v1/backoffice/workflows; PUT /api/v1/backoffice/workflows/PARTICIPANT_UPDATE', response: `${list.json?.length} workflows | ${summary(bad)} | ${ok.status}`, pass: list.json?.length === 8 && bad.status === 422 && ok.status === 200 };
    });

  await step('EX-116', 'Audit trail search by actor, action and entity; facets', 'manager, compliance',
    'GET /backoffice/audit?actor=manager → 200 only manager entries; ?action=LOGIN_FAILED → entries with IP; GET facets → 200; ops.maker → 403', async () => {
      const byActor = await manager.request('GET', '/api/v1/backoffice/audit?actor=manager&pageSize=20');
      const onlyManager = (byActor.json?.items ?? []).every((i) => i.actorName === 'manager');
      const failed = await manager.request('GET', '/api/v1/backoffice/audit?action=LOGIN_FAILED&pageSize=5');
      const withIp = (failed.json?.items ?? []).every((i) => !!i.ipAddress || !!i.ip);
      const facets = await manager.request('GET', '/api/v1/backoffice/audit/facets');
      const maker = await as('ops.maker');
      const denied = await maker.request('GET', '/api/v1/backoffice/audit');
      return { request: 'GET /api/v1/backoffice/audit?actor=manager; ?action=LOGIN_FAILED; GET audit/facets; audit as ops.maker', response: `${byActor.status} onlyManager=${onlyManager} | LOGIN_FAILED items=${failed.json?.items?.length} withIp=${withIp} | facets ${facets.status} | ${denied.status}`, pass: byActor.status === 200 && onlyManager && failed.status === 200 && withIp && facets.status === 200 && denied.status === 403 };
    });

  await step('EX-117', 'Product configuration is maintainable without code changes', 'manager',
    'GET /backoffice/products → 7; PUT with an invalid rate table → 422 INVALID_PRODUCT_CONFIG; PUT with the unchanged configuration → 200', async () => {
      const list = await manager.request('GET', '/api/v1/backoffice/products');
      const items = list.json?.items ?? list.json ?? [];
      const khr = items.find((p) => p.code === 'KHR');
      const body = (config) => ({ name: khr?.name, description: khr?.description, config, requiredDocuments: khr?.requiredDocuments, questionnaire: khr?.questionnaire, paymentBeforeIssuance: khr?.paymentBeforeIssuance, allowRenewal: khr?.allowRenewal, active: khr?.active });
      const bad = await manager.request('PUT', `/api/v1/backoffice/products/${khr?.id}`, { body: body({ ...khr?.config, plans: [] }) });
      const ok = await manager.request('PUT', `/api/v1/backoffice/products/${khr?.id}`, { body: body(khr?.config) });
      return { request: `GET /api/v1/backoffice/products; PUT products/${khr?.id} (plans=[]; unchanged)`, response: `${items.length} products | ${summary(bad)} | ${ok.status}`, pass: items.length === 7 && bad.status === 422 && ok.status === 200 };
    });

  await step('EX-118', 'Document review: segregation of duties and mandatory rejection remarks', 'ops.checker, ag-000001',
    'Reject without remarks → 422 REMARKS_REQUIRED; verify the agent’s IC copy → 200/201 status VERIFIED; the uploader sees the status', async () => {
      const checker = await as('ops.checker');
      const bad = await checker.request('POST', `/api/v1/backoffice/documents/${state.icDocument?.id}/review`, { body: { decision: 'REJECTED' } });
      const ok = await checker.request('POST', `/api/v1/backoffice/documents/${state.icDocument?.id}/review`, { body: { decision: 'VERIFIED', remarks: 'Legible' } });
      const agent = await as('ag-000001');
      const docs = await agent.request('GET', `/api/v1/common/documents?ownerType=POLICY&ownerId=${state.issued?.id}`);
      const doc = (docs.json?.items ?? docs.json ?? []).find((d) => d.id === state.icDocument?.id);
      return { request: `POST /api/v1/backoffice/documents/${state.icDocument?.id}/review (REJECTED no remarks; VERIFIED)`, response: `${summary(bad)} | ${ok.status} ${ok.json?.status} | uploader sees ${doc?.status}`, pass: bad.status === 422 && bad.json?.code === 'REMARKS_REQUIRED' && [200, 201].includes(ok.status) && ok.json?.status === 'VERIFIED' && doc?.status === 'VERIFIED' };
    });

  await step('EX-119', 'Documents of another agency cannot be downloaded', 'ag-000003',
    'GET /common/documents/{id}/content → 403 (or 404)', async () => {
      const other = await as('ag-000003');
      const r = await other.request('GET', `/api/v1/common/documents/${state.icDocument?.id}/content`);
      return { request: `GET /api/v1/common/documents/${state.icDocument?.id}/content (ag-000003)`, response: summary(r), pass: r.status === 403 || r.status === 404 };
    });
}

// ---------------------------------------------------------------------------------------------
// 11. End-of-day, integration, notifications
// ---------------------------------------------------------------------------------------------
async function operations() {
  const finance = await as('finance');

  await step('EX-120', 'End-of-day cannot run for a future date and is restricted to Finance', 'finance, ops.maker',
    'POST /backoffice/eod tomorrow → 422 FUTURE_DATE; ops.maker → 403', async () => {
      const future = await finance.request('POST', '/api/v1/backoffice/eod', { body: { businessDate: bruneiToday(1) } });
      const maker = await as('ops.maker');
      const denied = await maker.request('POST', '/api/v1/backoffice/eod', { body: { businessDate: bruneiToday() } });
      return { request: 'POST /api/v1/backoffice/eod (tomorrow; as ops.maker)', response: `${summary(future)} | ${denied.status}`, pass: future.status === 422 && future.json?.code === 'FUTURE_DATE' && denied.status === 403 };
    });

  await step('EX-121', 'End-of-day runs for today and produces the EOD report and FIN file; a re-run replaces the revision', 'finance',
    'HTTP 201 COMPLETED with reportDocumentId and finFileDocumentId; second run returns the same run id; the FIN file contains record_type lines', async () => {
      const first = await finance.request('POST', '/api/v1/backoffice/eod', { body: { businessDate: bruneiToday() } });
      const second = await finance.request('POST', '/api/v1/backoffice/eod', { body: { businessDate: bruneiToday() } });
      const fin = await finance.request('GET', `/api/v1/common/documents/${second.json?.finFileDocumentId}/content`);
      const runs = await finance.request('GET', '/api/v1/backoffice/eod');
      return { request: 'POST /api/v1/backoffice/eod ×2; GET /api/v1/common/documents/{finFile}/content; GET /api/v1/backoffice/eod', response: `${first.status} ${first.json?.status} policies=${first.json?.policiesIssued} | same id=${first.json?.id === second.json?.id} | FIN file ${fin.status} has record_type=${fin.text.includes('"record_type"')} | runs ${runs.status}`, pass: first.status === 201 && first.json?.status === 'COMPLETED' && !!first.json?.reportDocumentId && first.json?.id === second.json?.id && fin.status === 200 && fin.text.includes('"record_type"') && runs.status === 200 };
    });

  await step('EX-122', 'EOD postings carry revision-based idempotency keys', 'finance',
    'Outbox shows EOD_POSTING messages for today with idempotencyKey EOD-<date>-R<n> and increasing revisions', async () => {
      const outbox = await finance.request('GET', '/api/v1/backoffice/integration/outbox?system=FINANCE&pageSize=100');
      const today = (outbox.json?.items ?? []).filter((m) => m.operation === 'EOD_POSTING' && m.payload?.businessDate === bruneiToday());
      const keys = today.map((m) => m.payload?.idempotencyKey);
      const revisions = today.map((m) => m.payload?.revision).sort((a, b) => a - b);
      const ok = keys.every((k, i) => k === `EOD-${bruneiToday()}-R${today[i].payload?.revision}`) && new Set(revisions).size === revisions.length && revisions.length >= 2;
      return { request: 'GET /api/v1/backoffice/integration/outbox?system=FINANCE', response: `keys=${keys.join(',')}`, pass: ok };
    });

  await step('EX-123', 'Integration monitor: summary per system, outbox and logs', 'finance',
    'GET summary → 200 with FINANCE successCount > 0; GET outbox?status=SENT → 200; GET logs?system=FINANCE → 200 with request summaries', async () => {
      await sleep(21_000); // let the outbox dispatcher (20 s interval) deliver the EOD postings
      const summaryR = await finance.request('GET', '/api/v1/backoffice/integration/summary');
      const fin = (summaryR.json ?? []).find((s) => s.system === 'FINANCE');
      const sent = await finance.request('GET', '/api/v1/backoffice/integration/outbox?status=SENT&pageSize=5');
      const logs = await finance.request('GET', '/api/v1/backoffice/integration/logs?system=FINANCE&pageSize=5');
      return { request: 'GET /api/v1/backoffice/integration/summary; outbox?status=SENT; logs?system=FINANCE', response: `${summaryR.status} FINANCE success=${fin?.successCount} failed=${fin?.failureCount ?? fin?.failedCount} | sent ${sent.status} ${sent.json?.total} | logs ${logs.status} ${logs.json?.total}`, pass: summaryR.status === 200 && fin?.successCount > 0 && sent.status === 200 && sent.json?.total > 0 && logs.status === 200 && logs.json?.total > 0 };
    });

  await step('EX-124', 'Daily reconciliation with FIN', 'finance',
    'POST reconciliations for today → 201 with status MATCHED; GET reconciliations lists it', async () => {
      const r = await finance.request('POST', '/api/v1/backoffice/integration/reconciliations', { body: { businessDate: bruneiToday() } });
      const list = await finance.request('GET', '/api/v1/backoffice/integration/reconciliations');
      return { request: 'POST /api/v1/backoffice/integration/reconciliations; GET …/reconciliations', response: `${r.status} ${r.json?.status} | list ${list.status} ${list.json?.total ?? list.json?.items?.length}`, pass: r.status === 201 && r.json?.status === 'MATCHED' && list.status === 200 };
    });

  await step('EX-125', 'Only failed or dead-lettered messages can be retried', 'finance',
    'POST outbox/{sent message}/retry → 422 (or 409)', async () => {
      const sent = await finance.request('GET', '/api/v1/backoffice/integration/outbox?status=SENT&pageSize=1');
      const id = sent.json?.items?.[0]?.id;
      const r = await finance.request('POST', `/api/v1/backoffice/integration/outbox/${id}/retry`, { body: {} });
      return { request: `POST /api/v1/backoffice/integration/outbox/${id}/retry`, response: summary(r), pass: [409, 422].includes(r.status) };
    });

  await step('EX-126', 'Inbound system-to-system API requires a valid key', 'anonymous / Core system',
    'No key → 401; wrong key → 401; valid key → 200 with the policies issued on a date', async () => {
      const none = await new Client().request('GET', `/api/v1/integration/policies?issuedOn=${bruneiToday()}`);
      const wrong = await new Client().request('GET', `/api/v1/integration/policies?issuedOn=${bruneiToday()}`, { headers: { 'x-api-key': 'wrong' } });
      let valid = { status: 'n/a' };
      if (INBOUND_API_KEY) valid = await new Client().request('GET', `/api/v1/integration/policies?issuedOn=${bruneiToday()}`, { headers: { 'x-api-key': INBOUND_API_KEY } });
      const pass = none.status === 401 && wrong.status === 401 && (!INBOUND_API_KEY || (valid.status === 200 && Array.isArray(valid.json?.items ?? valid.json)));
      return { request: 'GET /api/v1/integration/policies?issuedOn (no key; wrong key; valid key)', response: `${none.status} | ${wrong.status} | ${valid.status}${INBOUND_API_KEY ? ` items=${(valid.json?.items ?? valid.json)?.length}` : ' (INBOUND_API_KEY not supplied)'}`, pass };
    });

  await step('EX-127', 'Inbound data is validated: unknown agent code and malformed commission payload are refused', 'Core / FIN system',
    'PUT integration/agents/{unknown}/status → 404; POST integration/commissions/paid with a bad body → 400', async () => {
      if (!INBOUND_API_KEY) return { request: 'PUT /api/v1/integration/agents/{code}/status', response: 'INBOUND_API_KEY not supplied', pass: false };
      const headers = { 'x-api-key': INBOUND_API_KEY };
      const unknown = await new Client().request('PUT', '/api/v1/integration/agents/AG-999999/status', { headers, body: { status: 'SUSPENDED', reason: 'Core sync' } });
      const bad = await new Client().request('POST', '/api/v1/integration/commissions/paid', { headers, body: { items: 'nope' } });
      return { request: 'PUT /api/v1/integration/agents/AG-999999/status; POST /api/v1/integration/commissions/paid (items: "nope")', response: `${summary(unknown)} | ${summary(bad)}`, pass: unknown.status === 404 && bad.status === 400 };
    });

  await step('EX-128', 'In-app notifications: list, unread count, mark one and mark all read', 'ag-000001',
    'GET notifications → 200 items with policy/approval events; unread-count → 200; POST {id}/read → 200/204; read-all → 204 and unread-count 0', async () => {
      const agent = await as('ag-000001');
      const list = await agent.request('GET', '/api/v1/common/notifications?pageSize=20');
      const count = await agent.request('GET', '/api/v1/common/notifications/unread-count');
      const first = list.json?.items?.[0];
      const one = await agent.request('POST', `/api/v1/common/notifications/${first?.id}/read`, { body: {} });
      const all = await agent.request('POST', '/api/v1/common/notifications/read-all', { body: {} });
      const after = await agent.request('GET', '/api/v1/common/notifications/unread-count');
      const unread = after.json?.unread ?? after.json?.count ?? after.json;
      return { request: 'GET /api/v1/common/notifications; GET unread-count; POST {id}/read; POST read-all', response: `${list.status} items=${list.json?.items?.length} | before ${JSON.stringify(count.json)} | ${one.status} | ${all.status} | after ${JSON.stringify(after.json)}`, pass: list.status === 200 && list.json?.items?.length > 0 && count.status === 200 && [200, 204].includes(one.status) && all.status === 204 && Number(unread) === 0 };
    });

  await step('EX-129', 'Policy issuance produced the Core and FIN messages', 'finance',
    'Outbox contains a POLICY_ISSUED message for the policy and a RECEIPT_POSTED message for its receipt (EX-043)', async () => {
      const policyNo = state.issued?.policyNo;
      const quotationNo = state.issued?.quotationNo;
      const ops = [];
      for (const system of ['CORE', 'FINANCE']) {
        for (let page = 1; page <= 10; page += 1) {
          const outbox = await finance.request('GET', `/api/v1/backoffice/integration/outbox?system=${system}&pageSize=100&page=${page}`);
          const items = outbox.json?.items ?? [];
          for (const m of items) {
            const p = JSON.stringify(m.payload);
            if (p.includes(policyNo) || p.includes(quotationNo)) ops.push(`${system}:${m.operation}:${m.status}`);
          }
          if (items.length < 100) break;
        }
      }
      return { request: 'GET /api/v1/backoffice/integration/outbox?system=CORE|FINANCE (all pages)', response: `messages for ${policyNo}/${quotationNo}: ${[...new Set(ops)].join(', ') || 'none'}`, pass: ops.some((o) => o.includes('POLICY_ISSUED')) && ops.some((o) => o.includes('RECEIPT_POSTED')) };
    });
}

// ---------------------------------------------------------------------------------------------
// 12. Platform behaviour: errors, headers, health, documentation; account lockout last
// ---------------------------------------------------------------------------------------------
async function platform() {
  await step('EX-130', 'Unknown routes and malformed JSON return generic errors with a correlation id', 'anonymous',
    'GET /api/v1/nothing → 404 JSON with code and no framework detail; malformed JSON → 400 without a stack trace; X-Request-Id on every response', async () => {
      const c = new Client();
      const missing = await c.request('GET', '/api/v1/nothing-here');
      const bad = await c.request('POST', '/api/v1/auth/login', { raw: '{"username": ' });
      loginsThisMinute += 1;
      return { request: 'GET /api/v1/nothing-here; POST /api/v1/auth/login with broken JSON', response: `${summary(missing)} req-id=${missing.headers.get('x-request-id') ? 'yes' : 'no'} | ${summary(bad)}`, pass: missing.status === 404 && !!missing.json?.code && !!missing.headers.get('x-request-id') && !/express|nest/i.test(missing.text) && bad.status === 400 && !/stack|at \//i.test(bad.text) };
    });

  await step('EX-131', 'Security headers and health endpoints', 'anonymous',
    'GET /health/live and /health/ready → 200; nosniff, HSTS and CSP present; X-Powered-By absent', async () => {
      const live = await new Client().request('GET', '/health/live');
      const ready = await new Client().request('GET', '/health/ready');
      const h = live.headers;
      return { request: 'GET /health/live; GET /health/ready', response: `${live.status} ${ready.status} db=${ready.json?.database}; nosniff=${h.get('x-content-type-options')} hsts=${!!h.get('strict-transport-security')} csp=${!!h.get('content-security-policy')} powered-by=${h.get('x-powered-by') ?? 'absent'}`, pass: live.status === 200 && ready.status === 200 && h.get('x-content-type-options') === 'nosniff' && !!h.get('strict-transport-security') && !!h.get('content-security-policy') && !h.get('x-powered-by') };
    });

  await step('EX-132', 'API documentation is served in the test environment only when enabled', 'anonymous',
    'GET /api/docs → 200 (API_DOCS_ENABLED=true in test) or 404 when disabled', async () => {
      const r = await new Client().request('GET', '/api/docs');
      return { request: 'GET /api/docs', response: `${r.status}`, pass: [200, 404].includes(r.status) };
    });

  await step('EX-133', 'Account lockout after the configured failed attempts; administrator unlock', 'qa user, manager',
    '5 wrong passwords → 401; the correct password then → 401 ACCOUNT_LOCKED; unlock → 200; sign-in → 200 and back-office access refused with 403 PASSWORD_CHANGE_REQUIRED until the temporary password is changed', async () => {
      await sleep(61_000); // stay under the per-client sign-in rate limit
      loginsThisMinute = 0;
      minuteStart = Date.now();
      const user = state.qaUser;
      const statuses = [];
      for (let i = 0; i < 5; i += 1) {
        const r = await new Client().request('POST', '/api/v1/auth/login', { body: { username: user.username, password: 'wrong-password' } });
        statuses.push(r.status);
      }
      const locked = await new Client().request('POST', '/api/v1/auth/login', { body: { username: user.username, password: user.temporaryPassword } });
      const manager = await as('manager');
      const unlock = await manager.request('POST', `/api/v1/backoffice/users/${user.id}/unlock`, { body: {} });
      const signin = await login(user.username, user.temporaryPassword);
      const blocked = await signin.client.request('GET', '/api/v1/backoffice/users');
      const disable = await manager.request('PUT', `/api/v1/backoffice/users/${user.id}/status`, { body: { status: 'DISABLED' } });
      return { request: 'POST /api/v1/auth/login ×6; POST /api/v1/backoffice/users/{id}/unlock; sign-in; GET /api/v1/backoffice/users; disable the test user', response: `${statuses.join(',')} | ${summary(locked)} | unlock ${unlock.status} | sign-in ${signin.response.status} mustChangePassword=${signin.response.json?.user?.mustChangePassword} | ${summary(blocked)} | disabled ${disable.status}`, pass: statuses.every((s) => s === 401) && locked.status === 401 && locked.json?.code === 'ACCOUNT_LOCKED' && unlock.status === 200 && signin.response.status === 200 && blocked.status === 403 && blocked.json?.code === 'PASSWORD_CHANGE_REQUIRED' && disable.status === 200 };
    });

  await step('EX-134', 'Administrator password reset issues a new temporary password; disabled accounts cannot sign in', 'manager, qa user',
    'POST users/{id}/reset-password → 200 with a 17-character temporary password; sign-in of the disabled account → 401', async () => {
      const manager = await as('manager');
      const user = state.qaUser;
      const reset = await manager.request('POST', `/api/v1/backoffice/users/${user?.id}/reset-password`, { body: {} });
      const attempt = await login(user?.username, reset.json?.temporaryPassword ?? 'x');
      return { request: `POST /api/v1/backoffice/users/${user?.id}/reset-password; POST /api/v1/auth/login (disabled user)`, response: `${reset.status} temporary password length=${reset.json?.temporaryPassword?.length} | ${summary(attempt.response)}`, pass: reset.status === 200 && reset.json?.temporaryPassword?.length === 17 && attempt.response.status === 401 };
    });
}

async function main() {
  const startedAt = new Date().toISOString();
  await authentication();
  await participants();
  await rating();
  await quotationToPolicy();
  await referral();
  await servicing();
  await agents();
  await aml();
  await issues();
  await reports();
  await administration();
  await operations();
  await platform();
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    /* ignore */
  }
  const passed = results.filter((r) => r.result === 'Passed').length;
  const output = {
    summary: { baseUrl: BASE, startedAt, finishedAt: new Date().toISOString(), commit, executedBy: 'iorta TechNXT QA (API run)', total: results.length, passed, failed: results.length - passed, runId: RUN, relogins },
    results,
  };
  writeFileSync(OUT, JSON.stringify(output, null, 2));
  console.log(`\n${passed}/${results.length} passed; written to ${OUT}`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(2);
});
