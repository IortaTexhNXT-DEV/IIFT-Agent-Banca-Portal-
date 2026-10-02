import { Module } from '@nestjs/common';
import {
  BackofficeDashboardController,
  PortalDashboardController,
} from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  controllers: [PortalDashboardController, BackofficeDashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
