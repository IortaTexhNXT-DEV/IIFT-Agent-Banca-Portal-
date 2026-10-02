import { Global, Module } from '@nestjs/common';
import {
  ApprovalsController,
  PortalRequestsController,
  WorkflowConfigController,
} from './workflow.controller.js';
import { WorkflowService } from './workflow.service.js';

@Global()
@Module({
  controllers: [ApprovalsController, WorkflowConfigController, PortalRequestsController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
