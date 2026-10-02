import { Module } from '@nestjs/common';
import { DocumentAccess } from './document-access.js';
import { DocumentStorage } from './document-storage.js';
import { DocumentReviewController, DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';
import { FileInspector } from './file-inspector.js';
import { PdfRenderer } from './pdf-renderer.js';

@Module({
  controllers: [DocumentsController, DocumentReviewController],
  providers: [DocumentsService, DocumentStorage, FileInspector, DocumentAccess, PdfRenderer],
  exports: [DocumentsService, DocumentStorage, PdfRenderer],
})
export class DocumentsModule {}
