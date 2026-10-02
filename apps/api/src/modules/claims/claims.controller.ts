import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { ClaimStatus } from '../../generated/prisma/enums.js';
import { ClaimsService } from './claims.service.js';

class CreateClaimDto {
  @ApiProperty() @IsUUID() policyId: string;
  @ApiProperty() @IsString() @MaxLength(50) claimType: string;
  @ApiProperty() @IsISO8601({ strict: true }) eventDate: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  claimedAmount?: number;
}

class ClaimQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(ClaimStatus) })
  @IsOptional()
  @IsIn(Object.values(ClaimStatus))
  status?: ClaimStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
}

class ValidatePolicyDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(20) policyNo: string;
}

class ClaimStatusDto {
  @ApiProperty({ enum: Object.values(ClaimStatus) })
  @IsIn(Object.values(ClaimStatus))
  status: ClaimStatus;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) remarks: string;
}

@ApiTags('Portal: Claims')
@ForAudience('PORTAL')
@Controller('portal/claims')
export class PortalClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  @RequirePermissions(Permission.PortalClaimsView)
  list(@CurrentUser() user: SessionUser, @Query() query: ClaimQueryDto) {
    return this.claims.list(user, query, query.status, query.search);
  }

  @Get('validate-policy')
  @RequirePermissions(Permission.PortalClaimsSubmit)
  validate(@CurrentUser() user: SessionUser, @Query() query: ValidatePolicyDto) {
    return this.claims.validatePolicy(user, query.policyNo);
  }

  @Get(':id')
  @RequirePermissions(Permission.PortalClaimsView)
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.detail(user, id);
  }

  @Post()
  @RequirePermissions(Permission.PortalClaimsSubmit)
  create(@CurrentUser() user: SessionUser, @Body() body: CreateClaimDto) {
    return this.claims.create(user, body);
  }
}

@ApiTags('Back-office: Claims')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoClaimsManage)
@Controller('backoffice/claims')
export class BackofficeClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: ClaimQueryDto) {
    return this.claims.list(user, query, query.status, query.search);
  }

  @Get(':id')
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.claims.detail(user, id);
  }

  @Put(':id/status')
  updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() body: ClaimStatusDto) {
    return this.claims.updateStatus(id, body.status, body.remarks);
  }
}
