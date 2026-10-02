import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { PortalSignatureController, PublicSignatureController } from './esign.controller.js';
import { ESignService } from './esign.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [PortalSignatureController, PublicSignatureController],
  providers: [ESignService],
})
export class ESignModule {}
