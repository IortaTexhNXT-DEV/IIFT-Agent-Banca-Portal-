import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { createApp, signIn } from './app.js';

describe('Authentication and session security (AP-01..04, BO-01)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects wrong credentials with a generic message', async () => {
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'nobody', password: 'x' })
      .expect(401);
    const wrong = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'finance', password: 'wrong-password' })
      .expect(401);
    expect(unknown.body.message).toBe(wrong.body.message);
    expect(unknown.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('issues an HttpOnly, SameSite=Strict session cookie and never returns secrets', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'finance', password: 'Demo@IIFT2026!' })
      .expect(200);
    const cookie = String(response.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|argon2/);
  });

  it('locks the account after the configured number of failed attempts', async () => {
    const server = app.getHttpServer();
    for (let attempt = 0; attempt < 5; attempt++) {
      await request(server)
        .post('/api/v1/auth/login')
        .send({ username: 'support', password: 'wrong-password' })
        .expect(401);
    }
    const locked = await request(server)
      .post('/api/v1/auth/login')
      .send({ username: 'support', password: 'Demo@IIFT2026!' })
      .expect(401);
    expect(locked.body.code).toBe('ACCOUNT_LOCKED');
    await app.get(PrismaService).user.update({
      where: { username: 'support' },
      data: { status: 'ACTIVE', lockedUntil: null, failedLoginCount: 0 },
    });
  });

  it('requires the CSRF token on state-changing requests', async () => {
    const session = await signIn(app, 'ag-000001');
    const withoutToken = await session.agent
      .post('/api/v1/common/notifications/read-all')
      .expect(403);
    expect(withoutToken.body.code).toBe('CSRF_TOKEN_INVALID');
    await session.agent
      .post('/api/v1/common/notifications/read-all')
      .set('x-csrf-token', 'forged')
      .expect(403);
    await session.agent
      .post('/api/v1/common/notifications/read-all')
      .set('x-csrf-token', session.csrf)
      .expect(204);
  });

  it('ends the session on logout', async () => {
    const session = await signIn(app, 'ag-000002');
    await session.agent.get('/api/v1/auth/me').expect(200);
    await session.agent.post('/api/v1/auth/logout').set('x-csrf-token', session.csrf).expect(204);
    await session.agent.get('/api/v1/auth/me').expect(401);
  });

  it('keeps only one active session per user', async () => {
    const first = await signIn(app, 'ag-000003');
    await signIn(app, 'ag-000003');
    const response = await first.agent.get('/api/v1/auth/me').expect(401);
    expect(response.body.code).toBe('NOT_AUTHENTICATED');
  });

  it('forces a temporary password to be changed before anything else', async () => {
    const admin = await signIn(app, 'admin', 'Temp#Admin2026x');
    const blocked = await admin.agent.get('/api/v1/backoffice/users').expect(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const weak = await admin.agent
      .post('/api/v1/auth/change-password')
      .set('x-csrf-token', admin.csrf)
      .send({ currentPassword: 'Temp#Admin2026x', newPassword: 'password1' })
      .expect(422);
    expect(weak.body.code).toBe('PASSWORD_POLICY');

    await admin.agent
      .post('/api/v1/auth/change-password')
      .set('x-csrf-token', admin.csrf)
      .send({ currentPassword: 'Temp#Admin2026x', newPassword: 'Adm1n!Secure#2026' })
      .expect(200);
    await admin.agent.get('/api/v1/backoffice/users').expect(200);
  });
});
