import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Response } from 'express';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { ExportFormat, ReportFrequency } from '../../generated/prisma/enums.js';
import type { ExportedReport } from './report-exporter.js';
import { ReportsService, type SchedulePeriod } from './reports.service.js';

const FORMATS = Object.values(ExportFormat);
const PERIODS: SchedulePeriod[] = [
  'PREVIOUS_DAY',
  'PREVIOUS_7_DAYS',
  'PREVIOUS_MONTH',
  'MONTH_TO_DATE',
];

class ReportFilterDto {
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agentId?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Z_]{2,30}$/) status?: string;
}

class ExportQueryDto extends ReportFilterDto {
  @ApiProperty({ enum: FORMATS }) @IsIn(FORMATS) format: ExportFormat;
}

class ScheduleDto {
  @ApiProperty() @Matches(/^[A-Z_]{3,50}$/) reportCode: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(150) name: string;
  @ApiProperty({ enum: Object.values(ReportFrequency) })
  @IsIn(Object.values(ReportFrequency))
  frequency: ReportFrequency;
  @ApiProperty({ enum: FORMATS }) @IsIn(FORMATS) format: ExportFormat;
  @ApiProperty({ enum: PERIODS }) @IsIn(PERIODS) period: SchedulePeriod;
  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsEmail({}, { each: true })
  recipients: string[];
}

class ActiveDto {
  @ApiProperty() @IsBoolean() active: boolean;
}

function send(response: Response, file: ExportedReport): StreamableFile {
  response.setHeader('Cache-Control', 'no-store');
  return new StreamableFile(file.content, {
    type: file.mimeType,
    disposition: `attachment; filename="${file.fileName}"`,
    length: file.content.length,
  });
}

@ApiTags('Portal: Reports')
@ForAudience('PORTAL')
@RequirePermissions(Permission.PortalReports)
@Controller('portal/reports')
export class PortalReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  catalogue(@CurrentUser() user: SessionUser) {
    return this.reports.catalogue(user);
  }

  @Get(':code')
  preview(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
    @Query() query: ReportFilterDto,
  ) {
    return this.reports.preview(user, code, query);
  }

  @Get(':code/export')
  async export(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return send(response, await this.reports.export(user, code, query, query.format));
  }
}

@ApiTags('Back-office: Reports')
@ForAudience('BACKOFFICE')
@Controller('backoffice/reports')
export class BackofficeReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @RequirePermissions(Permission.BoReportsView)
  catalogue(@CurrentUser() user: SessionUser) {
    return this.reports.catalogue(user);
  }

  @Get('schedules')
  @RequirePermissions(Permission.BoReportsSchedule)
  schedules() {
    return this.reports.listSchedules();
  }

  @Post('schedules')
  @RequirePermissions(Permission.BoReportsSchedule)
  createSchedule(@CurrentUser() user: SessionUser, @Body() body: ScheduleDto) {
    return this.reports.createSchedule(user, body);
  }

  @Put('schedules/:id/active')
  @RequirePermissions(Permission.BoReportsSchedule)
  setActive(@Param('id', ParseUUIDPipe) id: string, @Body() body: ActiveDto) {
    return this.reports.setScheduleActive(id, body.active);
  }

  @Get(':code')
  @RequirePermissions(Permission.BoReportsView)
  preview(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
    @Query() query: ReportFilterDto,
  ) {
    return this.reports.preview(user, code, query);
  }

  @Get(':code/export')
  @RequirePermissions(Permission.BoReportsView)
  async export(
    @CurrentUser() user: SessionUser,
    @Param('code') code: string,
    @Query() query: ExportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return send(response, await this.reports.export(user, code, query, query.format));
  }
}
