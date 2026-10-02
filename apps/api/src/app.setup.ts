import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import pg from 'pg';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter.js';
import { correlationId } from './common/http/correlation-id.js';
import { requestContextMiddleware } from './common/http/request-context.middleware.js';
import { AppConfig } from './config/app-config.js';

/**
 * HTTP pipeline shared by the server entry point and the end-to-end tests, so tests
 * exercise exactly the middleware, guards and error handling used in production.
 */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get(AppConfig);

  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.trustProxyHops);
  app.disable('x-powered-by');
  app.use(helmet());
  app.useBodyParser('json', { limit: '2mb' });

  // Order matters: correlation id → server-side session → per-request context.
  app.use(correlationId);
  app.use(
    session({
      store: new (connectPgSimple(session))({
        pool: new pg.Pool({ connectionString: config.databaseUrl, max: 5 }),
        tableName: 'user_session',
        createTableIfMissing: false,
        pruneSessionInterval: 15 * 60,
      }),
      name: config.session.cookieName,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: config.session.secureCookie,
        sameSite: 'strict',
        path: '/',
        maxAge: 15 * 60 * 1000,
      },
    }),
  );
  app.use(requestContextMiddleware);

  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready', 'metrics'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (config.corsOrigins.length > 0) {
    app.enableCors({ origin: config.corsOrigins, credentials: true });
  }

  if (config.apiDocsEnabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SalesVerse 2.0 – IIFT Agent/Banca Portal & Back-office API')
        .setVersion('1.0')
        .addCookieAuth(config.session.cookieName)
        .addApiKey({ type: 'apiKey', in: 'header', name: 'x-csrf-token' }, 'csrf')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
}
