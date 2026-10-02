import { Module, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics } from 'prom-client';
import { HealthController } from './health.controller.js';

let defaultMetricsStarted = false;

@Module({ controllers: [HealthController] })
export class HealthModule implements OnModuleInit {
  onModuleInit(): void {
    if (!defaultMetricsStarted) {
      collectDefaultMetrics({ prefix: 'iift_api_' });
      defaultMetricsStarted = true;
    }
  }
}
