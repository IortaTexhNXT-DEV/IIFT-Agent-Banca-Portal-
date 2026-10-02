import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Public } from '../../common/security/decorators.js';
import { parseIsoDate } from '../../common/util/dates.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { InboundIntegrationService } from './inbound-integration.service.js';

class AgentStatusSyncDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] })
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'])
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(300) reason: string;
}

class IssuedQueryDto {
  @ApiProperty({ example: '2026-10-01' }) @IsISO8601({ strict: true }) issuedOn: string;
}

class CommissionPaidItemDto {
  @ApiProperty() @IsString() @MaxLength(20) policyNo: string;
  @ApiProperty() @Matches(/^(AG|BK)-\d{6}$/) agentCode: string;
  @ApiProperty() @IsISO8601({ strict: true }) paidOn: string;
}

class CommissionPaidDto {
  @ApiProperty({ type: [CommissionPaidItemDto] })
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CommissionPaidItemDto)
  items: CommissionPaidItemDto[];
}

/** APIs exposed to IITH systems (INT-02, INT-05, INT-09). Authenticated by API key, not by session. */
@ApiTags('Integration (system-to-system)')
@ApiHeader({ name: 'x-api-key', required: true })
@Public()
@UseGuards(ApiKeyGuard)
@Controller('integration')
export class IntegrationApiController {
  constructor(private readonly inbound: InboundIntegrationService) {}

  @Put('agents/:agentCode/status')
  syncAgentStatus(@Param('agentCode') agentCode: string, @Body() body: AgentStatusSyncDto) {
    return this.inbound.syncAgentStatus(agentCode, body.status, body.reason);
  }

  @Get('policies')
  issuedPolicies(@Query() query: IssuedQueryDto) {
    return this.inbound.issuedPolicies(parseIsoDate(query.issuedOn));
  }

  @Post('commissions/paid')
  @HttpCode(200)
  commissionsPaid(@Body() body: CommissionPaidDto) {
    return this.inbound.markCommissionsPaid(body.items);
  }
}
