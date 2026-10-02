import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { PoliciesModule } from '../policies/policies.module.js';
import { BackofficeBillingController, PortalBillingController } from './billing.controller.js';
import { GracePeriodService } from './grace-period.service.js';
import { PaymentsService } from './payments.service.js';

@Module({
  imports: [DocumentsModule, PoliciesModule],
  controllers: [PortalBillingController, BackofficeBillingController],
  providers: [PaymentsService, GracePeriodService],
  exports: [GracePeriodService],
})
export class BillingModule {}
