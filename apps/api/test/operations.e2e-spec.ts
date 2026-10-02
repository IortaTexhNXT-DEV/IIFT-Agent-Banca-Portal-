import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { OutboxDispatcher } from '../src/modules/integration/outbox.dispatcher.js';
import { NotificationDispatcher } from '../src/modules/notifications/notification.dispatcher.js';
import { createApp, type Session, signIn } from './app.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const today = () => new Date().toISOString().slice(0, 10);

function write(
  session: Session,
  method: 'post' | 'put' | 'patch',
  path: string,
  body: object = {},
) {
  return session.agent[method](`/api/v1${path}`).set('x-csrf-token', session.csrf).send(body);
}

describe('Back-office operations', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let manager: Session;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    manager = await signIn(app, 'manager');
  });

  afterAll(async () => {
    await app.close();
  });

  it('onboards a sub-agent through registration, AML, documents and approval (AP-07, BO-10/13)', async () => {
    const principal = await signIn(app, 'ag-000001');
    const registered = await write(principal, 'post', '/portal/agents', {
      agentType: 'SUB_AGENT',
      fullName: 'Hazirah binti Jamil',
      idType: 'NRIC',
      idNumber: '01-445566',
      dateOfBirth: '1996-02-02',
      email: 'hazirah@agents.example',
      mobile: '6738445566',
    }).expect(201);
    expect(registered.body.status).toBe('PENDING');
    expect(registered.body.agentCode).toMatch(/^AG-\d{6}$/);

    const request = await prisma.approvalRequest.findFirstOrThrow({
      where: { entityId: registered.body.id, status: 'PENDING' },
    });
    const checker = await signIn(app, 'ops.checker');
    const early = await write(
      checker,
      'post',
      `/backoffice/approvals/${request.id}/approve`,
    ).expect(422);
    expect(early.body.code).toBe('DOCUMENTS_MISSING');

    await principal.agent
      .post('/api/v1/common/documents')
      .set('x-csrf-token', principal.csrf)
      .field('ownerType', 'AGENT')
      .field('ownerId', registered.body.id)
      .field('docType', 'IC_COPY')
      .attach('file', PDF, 'ic.pdf')
      .expect(201);
    await write(checker, 'post', `/backoffice/approvals/${request.id}/approve`, {
      remarks: 'IC verified',
    }).expect(200);

    const agent = await prisma.agent.findUniqueOrThrow({
      where: { id: registered.body.id },
      include: { user: true },
    });
    expect(agent.status).toBe('ACTIVE');
    expect(agent.user?.username).toBe(agent.agentCode.toLowerCase());
    expect(agent.user?.mustChangePassword).toBe(true);
  });

  it('routes a watch-list match to Compliance and records the review (AP-16, BO-13..15)', async () => {
    const compliance = await signIn(app, 'compliance');
    const cases = await compliance.agent.get('/api/v1/backoffice/aml/cases').expect(200);
    const flagged = cases.body.items.find(
      (c: { subjectName: string }) => c.subjectName === 'Ahmad Zulkifli bin Hamid',
    );
    expect(flagged.score).toBeGreaterThanOrEqual(85);
    await write(compliance, 'post', `/backoffice/aml/cases/${flagged.id}/review`, {
      decision: 'CONFIRMED_MATCH',
      remarks: 'Matches DEMO-001 listing',
    }).expect(201);
    const participant = await prisma.participant.findUniqueOrThrow({
      where: { id: flagged.subjectId },
    });
    expect(participant.amlStatus).toBe('REJECTED');

    const imported = await compliance.agent
      .post('/api/v1/backoffice/aml/watchlist/import')
      .set('x-csrf-token', compliance.csrf)
      .field('replaceList', 'false')
      .attach(
        'file',
        Buffer.from('list_name,full_name,id_number,country,reference\nLOCAL,"Doe, John",,BN,L-1\n'),
        'list.csv',
      )
      .expect(201);
    expect(imported.body.imported).toBe(1);
  });

  it('manages an issue through assignment, comments and resolution with SLA dates (AP-55..57, BO-29..31)', async () => {
    const agent = await signIn(app, 'ag-000001');
    const issue = await write(agent, 'post', '/common/issues', {
      title: 'Policy schedule shows wrong address',
      description: 'The e-Policy for PRO/26/000001 shows the old address of the participant.',
      category: 'QUOTATION_POLICY',
      priority: 'HIGH',
    }).expect(201);
    expect(
      new Date(issue.body.responseDueAt).getTime() - new Date(issue.body.createdAt).getTime(),
    ).toBe(2 * 3_600_000);

    const support = await signIn(app, 'support');
    const assignees = await support.agent.get('/api/v1/backoffice/issues/assignees').expect(200);
    await write(support, 'put', `/backoffice/issues/${issue.body.id}/assignment`, {
      assigneeId: assignees.body[0].id,
    }).expect(200);
    await write(support, 'post', `/common/issues/${issue.body.id}/comments`, {
      body: 'Checking with operations',
      internal: true,
    }).expect(201);
    await write(support, 'post', `/common/issues/${issue.body.id}/comments`, {
      body: 'Address updated; schedule reissued',
    }).expect(201);
    await write(support, 'put', `/common/issues/${issue.body.id}/status`, {
      status: 'RESOLVED',
    }).expect(422);
    await write(support, 'put', `/common/issues/${issue.body.id}/status`, {
      status: 'RESOLVED',
      resolution: 'Participant address corrected',
    }).expect(200);

    const seen = await agent.agent.get(`/api/v1/common/issues/${issue.body.id}`).expect(200);
    expect(seen.body.comments.map((c: { internal: boolean }) => c.internal)).toEqual([false]);
    await write(agent, 'put', `/common/issues/${issue.body.id}/status`, {
      status: 'CLOSED',
    }).expect(200);
  });

  it('accepts claim notifications only within the period of cover (AP-43)', async () => {
    const agent = await signIn(app, 'ag-000001');
    const policy = await prisma.policy.findFirstOrThrow({
      where: { status: 'ACTIVE', agent: { agentCode: 'AG-000001' }, product: { code: 'KHR' } },
    });
    await agent.agent
      .get('/api/v1/portal/claims/validate-policy')
      .query({ policyNo: policy.policyNo })
      .expect(200);
    const outside = await write(agent, 'post', '/portal/claims', {
      policyId: policy.id,
      claimType: 'DEATH',
      eventDate: '2020-01-01',
      description: 'Event long before the cover started.',
    }).expect(422);
    expect(outside.body.code).toBe('CLAIM_NOT_VALID');
    const claim = await write(agent, 'post', '/portal/claims', {
      policyId: policy.id,
      claimType: 'DEATH',
      eventDate: today(),
      description: 'Death of the covered person; certificate to follow.',
    }).expect(201);
    const ops = await signIn(app, 'ops.maker');
    await write(ops, 'put', `/backoffice/claims/${claim.body.id}/status`, {
      status: 'CLOSED',
      remarks: 'Skipping review',
    }).expect(422);
    await write(ops, 'put', `/backoffice/claims/${claim.body.id}/status`, {
      status: 'UNDER_REVIEW',
      remarks: 'Assessment started',
    }).expect(200);
  });

  it('runs every standard report and exports it in each format (BO-22..24)', async () => {
    const catalogue = await manager.agent.get('/api/v1/backoffice/reports').expect(200);
    expect(catalogue.body).toHaveLength(12);
    for (const report of catalogue.body as { code: string }[]) {
      const preview = await manager.agent
        .get(`/api/v1/backoffice/reports/${report.code}`)
        .query({ from: '2025-01-01', to: today() })
        .expect(200);
      expect(Array.isArray(preview.body.rows)).toBe(true);
    }
    const formats = { XLSX: 'spreadsheetml', CSV: 'text/csv', PDF: 'application/pdf' };
    for (const [format, type] of Object.entries(formats)) {
      const file = await manager.agent
        .get('/api/v1/backoffice/reports/POLICY_REGISTER/export')
        .query({ format })
        .buffer(true)
        .expect(200);
      expect(file.headers['content-type']).toContain(type);
    }
    const agent = await signIn(app, 'ag-000002');
    const portalCatalogue = await agent.agent.get('/api/v1/portal/reports').expect(200);
    expect(portalCatalogue.body.map((r: { code: string }) => r.code)).not.toContain(
      'AML_SCREENING',
    );
    await agent.agent.get('/api/v1/portal/reports/AML_SCREENING').expect(403);

    const schedule = await write(manager, 'post', '/backoffice/reports/schedules', {
      reportCode: 'COLLECTIONS',
      name: 'Daily collections',
      frequency: 'DAILY',
      format: 'XLSX',
      period: 'PREVIOUS_DAY',
      recipients: ['finance@iift.example'],
    }).expect(201);
    await write(manager, 'put', `/backoffice/reports/schedules/${schedule.body.id}/active`, {
      active: false,
    }).expect(200);
  });

  it('runs end-of-day, posts to FIN, reconciles and delivers integration messages (FFR EOD, INT-13..15)', async () => {
    const finance = await signIn(app, 'finance');
    const eod = await write(finance, 'post', '/backoffice/eod', { businessDate: today() }).expect(
      201,
    );
    expect(eod.body.status).toBe('COMPLETED');
    expect(eod.body.reportDocumentId).toBeTruthy();
    const rerun = await write(finance, 'post', '/backoffice/eod', { businessDate: today() }).expect(
      201,
    );
    expect(rerun.body.id).toBe(eod.body.id);
    const postings = await prisma.outboxMessage.findMany({
      where: { operation: 'EOD_POSTING', aggregateId: eod.body.id },
      orderBy: { createdAt: 'asc' },
    });
    const keys = postings.map((m) => (m.payload as { idempotencyKey: string }).idempotencyKey);
    expect(keys.slice(-2)).toEqual([
      `EOD-${today()}-R${keys.length - 1}`,
      `EOD-${today()}-R${keys.length}`,
    ]);
    const fin = await finance.agent
      .get(`/api/v1/common/documents/${eod.body.finFileDocumentId}/content`)
      .buffer(true)
      .expect(200);
    expect(fin.text).toContain('"record_type"');

    await app.get(OutboxDispatcher).dispatchDue();
    await app.get(NotificationDispatcher).dispatchPending();
    const summary = await finance.agent.get('/api/v1/backoffice/integration/summary').expect(200);
    expect(
      summary.body.find((s: { system: string }) => s.system === 'FINANCE').successCount,
    ).toBeGreaterThan(0);

    const reconciliation = await write(finance, 'post', '/backoffice/integration/reconciliations', {
      businessDate: today(),
    }).expect(201);
    expect(reconciliation.body.status).toBe('MATCHED');

    const dead = await prisma.outboxMessage.create({
      data: {
        system: 'CORE',
        operation: 'UNKNOWN_OPERATION',
        payload: {},
        status: 'DEAD',
        attempts: 6,
      },
    });
    await write(finance, 'post', `/backoffice/integration/outbox/${dead.id}/retry`).expect(200);
    // The dispatcher works in batches; drain the queue so the retried message is attempted.
    while (
      (await prisma.outboxMessage.count({
        where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } },
      })) > 0
    ) {
      await app.get(OutboxDispatcher).dispatchDue();
    }
    expect((await prisma.outboxMessage.findUniqueOrThrow({ where: { id: dead.id } })).status).toBe(
      'DEAD',
    );
  });

  it('administers users, roles, parameters, master data and workflows with an audit trail (BO-03/04/26..33, COM-04)', async () => {
    const roles = await manager.agent.get('/api/v1/backoffice/role-options').expect(200);
    const auditor = roles.body.find((r: { code: string }) => r.code === 'AUDITOR');
    const created = await write(manager, 'post', '/backoffice/users', {
      username: 'auditor.test',
      fullName: 'Audit Tester',
      email: 'auditor@iift.example',
      authSource: 'LOCAL',
      roleIds: [auditor.id],
    }).expect(201);
    expect(created.body.temporaryPassword).toHaveLength(17);
    const portalRole = roles.body.find((r: { audience: string }) => r.audience === 'PORTAL');
    await write(manager, 'patch', `/backoffice/users/${created.body.user.id}`, {
      roleIds: [portalRole.id],
    }).expect(422);
    await write(manager, 'post', `/backoffice/users/${created.body.user.id}/reset-password`).expect(
      200,
    );
    await write(manager, 'put', `/backoffice/users/${created.body.user.id}/status`, {
      status: 'DISABLED',
    }).expect(200);
    await write(manager, 'put', `/backoffice/users/${manager.userId}/status`, {
      status: 'DISABLED',
    }).expect(422);

    const role = await write(manager, 'post', '/backoffice/roles', {
      code: 'READ_ONLY_TEST',
      name: 'Read only',
      audience: 'BACKOFFICE',
      permissions: ['bo.dashboard', 'portal.dashboard'],
    }).expect(422);
    expect(role.body.code).toBe('INVALID_PERMISSION');

    await write(manager, 'put', '/backoffice/config/parameters/billing.payment_grace_days', {
      value: '0',
    }).expect(422);
    await write(manager, 'put', '/backoffice/config/parameters/billing.payment_grace_days', {
      value: '10',
    }).expect(200);
    await write(manager, 'put', '/backoffice/config/parameters/billing.payment_grace_days', {
      value: '7',
    }).expect(200);
    await write(manager, 'post', '/backoffice/config/codes', {
      category: 'CLAIM_TYPE',
      code: 'CRITICAL_ILLNESS',
      label: 'Critical illness',
    }).expect(201);

    const workflows = await manager.agent.get('/api/v1/backoffice/workflows').expect(200);
    expect(workflows.body).toHaveLength(8);
    await write(manager, 'put', '/backoffice/workflows/PARTICIPANT_UPDATE', {
      active: true,
      steps: [{ name: 'Anyone', permission: 'bo.users.manage' }],
    }).expect(422);
    await write(manager, 'put', '/backoffice/workflows/PARTICIPANT_UPDATE', {
      active: true,
      steps: [{ name: 'Operations supervisor approval', permission: 'bo.approve.participants' }],
    }).expect(200);

    const audit = await manager.agent
      .get('/api/v1/backoffice/audit')
      .query({ entityType: 'ConfigParameter' })
      .expect(200);
    expect(audit.body.items[0]).toMatchObject({
      action: 'PARAMETER_UPDATED',
      actorName: 'manager',
    });
    await manager.agent.get('/api/v1/backoffice/audit/facets').expect(200);
  });

  it('serves the dashboards (AP-52/53, BO-20/21)', async () => {
    const dashboard = await manager.agent.get('/api/v1/backoffice/dashboard').expect(200);
    expect(dashboard.body.kpis.policiesYtd).toBeGreaterThan(0);
    expect(dashboard.body.trend).toHaveLength(12);
    const blocked = await signIn(app, 'bk-000004');
    const portal = await blocked.agent.get('/api/v1/portal/dashboard').expect(200);
    expect(portal.body.profile.agency.issuanceBlocked).toBe(true);
    expect(portal.body.pendingActions[0].type).toBe('AGENCY_BLOCKED');
  });
});
