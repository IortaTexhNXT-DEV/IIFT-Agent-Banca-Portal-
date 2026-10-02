import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { BackofficeClaimsController, PortalClaimsController } from './claims.controller.js';
import { ClaimsService } from './claims.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [PortalClaimsController, BackofficeClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
