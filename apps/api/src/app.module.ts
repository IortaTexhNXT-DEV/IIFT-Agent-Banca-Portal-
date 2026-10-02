import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { CommonModule } from './common/common.module.js';
import { AppConfig } from './config/app-config.js';
import { AppConfigModule } from './config/config.module.js';
import { AccessModule } from './modules/access/access.module.js';
import { AgencyModule } from './modules/agency/agency.module.js';
import { AmlModule } from './modules/aml/aml.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AuthenticationGuard } from './modules/auth/guards/authentication.guard.js';
import { CsrfGuard } from './modules/auth/guards/csrf.guard.js';
import { PermissionsGuard } from './modules/auth/guards/permissions.guard.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { ClaimsModule } from './modules/claims/claims.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { EodModule } from './modules/eod/eod.module.js';
import { ESignModule } from './modules/esign/esign.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IntegrationApiModule } from './modules/integration-api/integration-api.module.js';
import { IntegrationModule } from './modules/integration/integration.module.js';
import { IssuesModule } from './modules/issues/issues.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ParticipantsModule } from './modules/participants/participants.module.js';
import { PoliciesModule } from './modules/policies/policies.module.js';
import { ProductsModule } from './modules/products/products.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { WorkflowModule } from './modules/workflow/workflow.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: process.env.LOG_LEVEL ?? (config.isProduction ? 'info' : 'debug'),
          genReqId: (request) => String(request.id),
          redact: {
            paths: [
              'req.headers.cookie',
              'req.headers.authorization',
              'req.headers["x-csrf-token"]',
              'res.headers["set-cookie"]',
            ],
            censor: '[REDACTED]',
          },
          autoLogging: { ignore: (request) => request.url?.startsWith('/health') ?? false },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 300 }]),
    ScheduleModule.forRoot(),
    CommonModule,
    AuditModule,
    SettingsModule,
    AuthModule,
    NotificationsModule,
    WorkflowModule,
    IntegrationModule,
    AccessModule,
    AmlModule,
    ProductsModule,
    DocumentsModule,
    AgencyModule,
    ParticipantsModule,
    PoliciesModule,
    BillingModule,
    ClaimsModule,
    ESignModule,
    IssuesModule,
    ReportsModule,
    DashboardModule,
    EodModule,
    IntegrationApiModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
  ],
})
export class AppModule {}
