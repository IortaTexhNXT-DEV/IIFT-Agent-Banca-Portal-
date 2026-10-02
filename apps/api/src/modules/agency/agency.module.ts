import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import {
  AgenciesController,
  BackofficeAgentsController,
  PortalAgencyController,
} from './agency.controller.js';
import { AgenciesService } from './agencies.service.js';
import {
  AgentProfileUpdateHandler,
  AgentRegistrationHandler,
  AgentStatusChangeHandler,
} from './agent-approval.handlers.js';
import { AgentsService } from './agents.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [AgenciesController, BackofficeAgentsController, PortalAgencyController],
  providers: [
    AgenciesService,
    AgentsService,
    AgentRegistrationHandler,
    AgentProfileUpdateHandler,
    AgentStatusChangeHandler,
  ],
  exports: [AgentsService],
})
export class AgencyModule {}
