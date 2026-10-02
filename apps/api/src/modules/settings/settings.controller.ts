import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import { CODE_CATEGORIES, type CodeCategory, MasterDataService } from './master-data.service.js';
import { SettingsService } from './settings.service.js';

class UpdateParameterDto {
  @ApiProperty() @IsString() @MaxLength(1000) value: string;
}

class CreateCodeItemDto {
  @ApiProperty({ enum: CODE_CATEGORIES }) @IsIn(CODE_CATEGORIES) category: CodeCategory;
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9_]{1,50}$/) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(150) label: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class UpdateCodeItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(150) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

class CodeQueryDto {
  @ApiPropertyOptional({ enum: CODE_CATEGORIES })
  @IsOptional()
  @IsIn(CODE_CATEGORIES)
  category?: CodeCategory;
}

/** Lookup values for drop-downs — available to every signed-in user. */
@ApiTags('Common: Master data')
@Controller('common/codes')
export class CodesController {
  constructor(private readonly masterData: MasterDataService) {}

  @Get()
  list(@Query() query: CodeQueryDto) {
    return this.masterData.list(query.category, true);
  }
}

/** BO-32/33, COM-09: system parameters and master data maintenance. */
@ApiTags('Back-office: Configuration')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoConfigManage)
@Controller('backoffice/config')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly masterData: MasterDataService,
  ) {}

  @Get('parameters')
  parameters() {
    return this.settings.list();
  }

  @Put('parameters/:key')
  updateParameter(@Param('key') key: string, @Body() body: UpdateParameterDto) {
    return this.settings.update(key, body.value);
  }

  @Get('codes')
  codes(@Query() query: CodeQueryDto) {
    return this.masterData.list(query.category);
  }

  @Get('code-categories')
  categories() {
    return CODE_CATEGORIES;
  }

  @Post('codes')
  createCode(@Body() body: CreateCodeItemDto) {
    return this.masterData.create(body);
  }

  @Patch('codes/:id')
  updateCode(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateCodeItemDto) {
    return this.masterData.update(id, body);
  }
}
