import { Global, Module } from '@nestjs/common';
import { CoreSystemGateway, FinanceGateway } from './gateways.js';
import { IntegrationMonitorController } from './integration-monitor.controller.js';
import { OutboxDispatcher } from './outbox.dispatcher.js';
import { OutboxService } from './outbox.service.js';
import { ReconciliationService } from './reconciliation.service.js';

@Global()
@Module({
  controllers: [IntegrationMonitorController],
  providers: [
    OutboxService,
    OutboxDispatcher,
    CoreSystemGateway,
    FinanceGateway,
    ReconciliationService,
  ],
  exports: [OutboxService, ReconciliationService, OutboxDispatcher],
})
export class IntegrationModule {}
