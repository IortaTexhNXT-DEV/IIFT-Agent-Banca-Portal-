import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import {
  BackofficeParticipantsController,
  PortalParticipantsController,
} from './participants.controller.js';
import { ParticipantsService } from './participants.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [PortalParticipantsController, BackofficeParticipantsController],
  providers: [ParticipantsService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
