import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { BackofficePoliciesController, PortalPoliciesController } from './policies.controller.js';
import { PoliciesService } from './policies.service.js';
import { POLICY_HANDLERS } from './policy-approval.handlers.js';
import { PolicyIssuanceService } from './policy-issuance.service.js';
import { PolicyJobs } from './policy.jobs.js';

@Module({
  imports: [DocumentsModule],
  controllers: [PortalPoliciesController, BackofficePoliciesController],
  providers: [PoliciesService, PolicyIssuanceService, PolicyJobs, ...POLICY_HANDLERS],
  exports: [PoliciesService, PolicyIssuanceService],
})
export class PoliciesModule {}
