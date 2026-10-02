import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { ReportExporter } from './report-exporter.js';
import { BackofficeReportsController, PortalReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [PortalReportsController, BackofficeReportsController],
  providers: [ReportsService, ReportExporter],
  exports: [ReportExporter],
})
export class ReportsModule {}
