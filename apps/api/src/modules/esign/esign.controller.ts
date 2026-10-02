import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { Request } from 'express';
import {
  CurrentUser,
  ForAudience,
  Public,
  RequirePermissions,
} from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { ESignService } from './esign.service.js';

const MAX_DATA_URL = 720_000;

class CaptureSignatureDto {
  @ApiProperty({ enum: ['AGENT', 'PARTICIPANT'] }) @IsIn(['AGENT', 'PARTICIPANT']) signer:
    'AGENT' | 'PARTICIPANT';
  @ApiProperty() @IsString() @MaxLength(MAX_DATA_URL) imageDataUrl: string;
}

class SignatureLinkDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}

class PublicSignDto {
  @ApiProperty() @IsString() @MaxLength(MAX_DATA_URL) imageDataUrl: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @ApiProperty() @IsBoolean() @Equals(true) consent: boolean;
}

@ApiTags('Portal: e-Signature')
@ForAudience('PORTAL')
@RequirePermissions(Permission.PortalPoliciesQuote)
@Controller('portal/policies/:id/signatures')
export class PortalSignatureController {
  constructor(private readonly esign: ESignService) {}

  @Post()
  capture(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CaptureSignatureDto,
  ) {
    return this.esign.captureSignature(user, id, body.signer, body.imageDataUrl);
  }

  @Post('link')
  @HttpCode(200)
  sendLink(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SignatureLinkDto,
  ) {
    return this.esign.sendSignatureLink(user, id, body.email);
  }
}

/** Public e-signature page used by participants from the emailed link. */
@ApiTags('Public: e-Signature')
@Public()
@Throttle({ default: { limit: 20, ttl: 60_000 } })
@Controller('public/esign')
export class PublicSignatureController {
  constructor(private readonly esign: ESignService) {}

  @Get(':token')
  view(@Param('token') token: string) {
    return this.esign.viewByToken(token);
  }

  @Post(':token')
  @HttpCode(200)
  sign(@Param('token') token: string, @Body() body: PublicSignDto, @Req() request: Request) {
    return this.esign.signByToken(token, body.imageDataUrl, body.fullName, request.ip);
  }
}
