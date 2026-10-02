import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BusinessRuleError } from '../../common/http/errors.js';
import { PageQueryDto } from '../../common/http/pagination.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { AmlCaseStatus } from '../../generated/prisma/enums.js';
import { AmlService } from './aml.service.js';
import { WatchlistService } from './watchlist.service.js';

class CaseQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(AmlCaseStatus) })
  @IsOptional()
  @IsIn(Object.values(AmlCaseStatus))
  status?: AmlCaseStatus;
}

class ReviewDto {
  @ApiProperty({ enum: ['CLEARED', 'CONFIRMED_MATCH'] })
  @IsIn(['CLEARED', 'CONFIRMED_MATCH'])
  decision: 'CLEARED' | 'CONFIRMED_MATCH';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) remarks: string;
}

class WatchlistQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) search?: string;
}

class WatchlistEntryDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(50) listName: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) idNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) reference?: string;
}

class ActiveDto {
  @ApiProperty() @IsBoolean() active: boolean;
}

class ImportDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  replaceList?: boolean;
}

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/** BO-13..15: AML/KYC compliance review and watch-list maintenance. */
@ApiTags('Back-office: AML/KYC')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoAmlReview)
@Controller('backoffice/aml')
export class AmlController {
  constructor(
    private readonly aml: AmlService,
    private readonly watchlist: WatchlistService,
  ) {}

  @Get('cases')
  cases(@Query() query: CaseQueryDto) {
    return this.aml.cases(query, query.status);
  }

  @Post('cases/:id/review')
  review(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewDto,
  ) {
    return this.aml.review(user, id, body.decision, body.remarks);
  }

  @Get('watchlist')
  search(@Query() query: WatchlistQueryDto) {
    return this.watchlist.search(query, query.search);
  }

  @Post('watchlist')
  add(@Body() body: WatchlistEntryDto) {
    return this.watchlist.add(body);
  }

  @Put('watchlist/:id/active')
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: ActiveDto) {
    return this.watchlist.setActive(id, body.active);
  }

  @Post('watchlist/import')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_CSV_BYTES, files: 1 } }))
  import(@Body() body: ImportDto, @UploadedFile() file?: { buffer: Buffer; size: number }) {
    if (!file || file.size === 0) {
      throw new BusinessRuleError('FILE_REQUIRED', 'Please choose a CSV file');
    }
    return this.watchlist.importCsv(file.buffer.toString('utf8'), body.replaceList ?? false);
  }
}
