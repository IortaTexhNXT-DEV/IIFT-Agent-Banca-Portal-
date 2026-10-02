import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { DEMO_PASSWORD } from './test-env.js';

export async function createApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

export type HttpAgent = ReturnType<typeof request.agent>;

export interface Session {
  agent: HttpAgent;
  csrf: string;
  userId: string;
}

/** Signs in and returns a cookie-keeping client plus the CSRF token for writes. */
export async function signIn(
  app: NestExpressApplication,
  username: string,
  password = DEMO_PASSWORD,
): Promise<Session> {
  const agent = request.agent(app.getHttpServer());
  const response = await agent.post('/api/v1/auth/login').send({ username, password }).expect(200);
  return { agent, csrf: response.body.csrfToken, userId: response.body.user.id };
}
