import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { createApp, signIn } from './app.js';
import { INBOUND_API_KEY } from './test-env.js';

describe('Access control and input handling (AP-59, BO-02, COM-02, NFR-10/14/15)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/portal/policies').expect(401);
    expect(response.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('keeps portal users out of the back-office API and vice versa', async () => {
    const agent = await signIn(app, 'ag-000001');
    expect((await agent.agent.get('/api/v1/backoffice/agents').expect(403)).body.code).toBe(
      'WRONG_AUDIENCE',
    );
    const staff = await signIn(app, 'finance');
    expect((await staff.agent.get('/api/v1/portal/policies').expect(403)).body.code).toBe(
      'WRONG_AUDIENCE',
    );
  });

  it('enforces permissions within the back-office', async () => {
    const maker = await signIn(app, 'ops.maker');
    expect((await maker.agent.get('/api/v1/backoffice/users').expect(403)).body.code).toBe(
      'FORBIDDEN',
    );
  });

  it('restricts records to the agent hierarchy and agency', async () => {
    const mainAgentPolicy = await prisma.policy.findFirstOrThrow({
      where: { agent: { agentCode: 'AG-000001' } },
    });
    const otherAgency = await signIn(app, 'ag-000003');
    await otherAgency.agent.get(`/api/v1/portal/policies/${mainAgentPolicy.id}`).expect(404);
    const subAgent = await signIn(app, 'ag-000002');
    await subAgent.agent.get(`/api/v1/portal/policies/${mainAgentPolicy.id}`).expect(404);
    const mainAgent = await signIn(app, 'ag-000001');
    await mainAgent.agent.get(`/api/v1/portal/policies/${mainAgentPolicy.id}`).expect(200);
  });

  it('treats injection attempts in search parameters as plain text', async () => {
    const session = await signIn(app, 'ag-000001');
    const response = await session.agent
      .get('/api/v1/portal/policies')
      .query({ search: "' OR 1=1; DROP TABLE policy; --" })
      .expect(200);
    expect(response.body.items).toEqual([]);
    expect(await prisma.policy.count()).toBeGreaterThan(0);
  });

  it('rejects unknown and malformed fields', async () => {
    const session = await signIn(app, 'ag-000001');
    const response = await session.agent
      .post('/api/v1/portal/participants')
      .set('x-csrf-token', session.csrf)
      .send({
        type: 'INDIVIDUAL',
        fullName: 'Test',
        idType: 'NRIC',
        idNumber: '01-555555',
        mobile: 'abc',
        addressLine1: 'Somewhere',
        isAdmin: true,
      })
      .expect(400);
    expect(response.body.details.join(' ')).toMatch(/isAdmin should not exist/);
    expect(response.body.details.join(' ')).toMatch(/mobile/);
  });

  it('never exposes internal error details and returns a correlation id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/portal/policies/not-a-uuid')
      .expect(401);
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(JSON.stringify(response.body)).not.toMatch(/stack|prisma|at \//i);
  });

  it('sends security headers and hides the framework', async () => {
    const response = await request(app.getHttpServer()).get('/health/live').expect(200);
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('authenticates system-to-system calls with an API key', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/integration/policies')
      .query({ issuedOn: '2026-01-01' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/integration/policies')
      .query({ issuedOn: '2026-01-01' })
      .set('x-api-key', 'wrong')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/integration/policies')
      .query({ issuedOn: '2026-01-01' })
      .set('x-api-key', INBOUND_API_KEY)
      .expect(200);
  });

  it('stores identification numbers encrypted and shows them masked', async () => {
    const participant = await prisma.participant.findFirstOrThrow();
    expect(participant.idNumberEnc.startsWith('v1:')).toBe(true);
    const session = await signIn(app, 'manager');
    const response = await session.agent
      .get(`/api/v1/backoffice/participants/${participant.id}`)
      .expect(200);
    expect(response.body.idNumberMasked).toMatch(/^\*+\d{4}$/);
    expect(response.body).not.toHaveProperty('idNumberEnc');
  });

  it('keeps the audit trail append-only at database level', async () => {
    await expect(prisma.$executeRaw`UPDATE audit_log SET action = 'TAMPERED'`).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.$executeRaw`DELETE FROM audit_log`).rejects.toThrow(/append-only/);
  });
});
