import { Global, Module } from '@nestjs/common';
import { MasterDataService } from './master-data.service.js';
import { CodesController, SettingsController } from './settings.controller.js';
import { SettingsService } from './settings.service.js';

@Global()
@Module({
  controllers: [CodesController, SettingsController],
  providers: [SettingsService, MasterDataService],
  exports: [SettingsService, MasterDataService],
})
export class SettingsModule {}
