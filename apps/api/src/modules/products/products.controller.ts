import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsObject, IsString, MaxLength, MinLength } from 'class-validator';
import { ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ProductsService } from './products.service.js';

class UpdateProductDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(150) name: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) description: string;
  @ApiProperty() @IsObject() config: Prisma.InputJsonObject;
  @ApiProperty() @IsArray() requiredDocuments: Prisma.InputJsonArray;
  @ApiProperty() @IsArray() questionnaire: Prisma.InputJsonArray;
  @ApiProperty() @IsBoolean() paymentBeforeIssuance: boolean;
  @ApiProperty() @IsBoolean() allowRenewal: boolean;
  @ApiProperty() @IsBoolean() active: boolean;
}

/** Products offered through the portal (AP-17). */
@ApiTags('Common: Products')
@Controller('common/products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list(true);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.get(id);
  }
}

@ApiTags('Back-office: Products')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoProductsManage)
@Controller('backoffice/products')
export class ProductAdminController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list() {
    return this.products.list(false);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateProductDto) {
    return this.products.update(id, body);
  }
}
