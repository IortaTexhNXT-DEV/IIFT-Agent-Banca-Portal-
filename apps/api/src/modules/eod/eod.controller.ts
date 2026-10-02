import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { parseIsoDate } from '../../common/util/dates.js';
import { EodService } from './eod.service.js';

class RunEodDto {
  @ApiProperty({ example: '2026-10-01' }) @IsISO8601({ strict: true }) businessDate: string;
}

@ApiTags('Back-office: End of day')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoEodRun)
@Controller('backoffice/eod')
export class EodController {
  constructor(private readonly eod: EodService) {}

  @Get()
  list(@Query() query: PageQueryDto) {
    return this.eod.list(query);
  }

  @Post()
  run(@CurrentUser() user: SessionUser, @Body() body: RunEodDto) {
    return this.eod.run(parseIsoDate(body.businessDate), user.fullName);
  }
}
