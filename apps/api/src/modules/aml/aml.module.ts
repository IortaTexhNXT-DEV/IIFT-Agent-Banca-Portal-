import { Global, Module } from '@nestjs/common';
import { AmlController } from './aml.controller.js';
import { AmlService } from './aml.service.js';
import { WatchlistService } from './watchlist.service.js';

@Global()
@Module({
  controllers: [AmlController],
  providers: [AmlService, WatchlistService],
  exports: [AmlService],
})
export class AmlModule {}
