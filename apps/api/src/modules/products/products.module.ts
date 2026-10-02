import { Global, Module } from '@nestjs/common';
import { ProductAdminController, ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Global()
@Module({
  controllers: [ProductsController, ProductAdminController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
