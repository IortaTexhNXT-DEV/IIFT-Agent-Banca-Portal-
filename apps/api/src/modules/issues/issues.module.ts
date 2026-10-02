import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { IssueManagementController, IssuesController } from './issues.controller.js';
import { IssuesService } from './issues.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [IssuesController, IssueManagementController],
  providers: [IssuesService],
})
export class IssuesModule {}
