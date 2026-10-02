import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard.js';
import { IntegrationApiController } from './integration-api.controller.js';
import { InboundIntegrationService } from './inbound-integration.service.js';

@Module({
  controllers: [IntegrationApiController],
  providers: [InboundIntegrationService, ApiKeyGuard],
})
export class IntegrationApiModule {}
