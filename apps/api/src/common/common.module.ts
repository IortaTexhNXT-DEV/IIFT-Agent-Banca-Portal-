import { Global, Module } from '@nestjs/common';
import { FieldCryptoService } from './crypto/field-crypto.service.js';
import { NumberingService } from './numbering/numbering.service.js';
import { DataScopeService } from './security/data-scope.service.js';
import { PrismaService } from './prisma/prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, FieldCryptoService, NumberingService, DataScopeService],
  exports: [PrismaService, FieldCryptoService, NumberingService, DataScopeService],
})
export class CommonModule {}
