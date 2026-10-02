import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { EodController } from './eod.controller.js';
import { EodService } from './eod.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [EodController],
  providers: [EodService],
})
export class EodModule {}
