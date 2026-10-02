import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import type { UploadedFile as UploadedFileData } from '../documents/file-inspector.js';
import { CommissionQueryDto, PaymentQueryDto, SubmitPaymentDto } from './billing.dto.js';
import { PaymentsService } from './payments.service.js';

@ApiTags('Portal: Billing')
@ForAudience('PORTAL')
@Controller('portal/billing')
export class PortalBillingController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('outstanding')
  @RequirePermissions(Permission.PortalBillingView)
  outstanding(@CurrentUser() user: SessionUser) {
    return this.payments.outstanding(user);
  }

  @Get('payments')
  @RequirePermissions(Permission.PortalBillingView)
  list(@CurrentUser() user: SessionUser, @Query() query: PaymentQueryDto) {
    return this.payments.list(user, query);
  }

  @Get('payments/:id')
  @RequirePermissions(Permission.PortalBillingView)
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.detail(user, id);
  }

  @Post('payments')
  @ApiConsumes('multipart/form-data')
  @RequirePermissions(Permission.PortalBillingSubmit)
  @UseInterceptors(FileInterceptor('proof', { limits: { fileSize: 25 * 1024 * 1024, files: 1 } }))
  submit(
    @CurrentUser() user: SessionUser,
    @Body() body: SubmitPaymentDto,
    @UploadedFile() proof?: UploadedFileData,
  ) {
    return this.payments.submit(user, body, proof);
  }

  @Get('commissions')
  @RequirePermissions(Permission.PortalCommissionView)
  commissions(@CurrentUser() user: SessionUser, @Query() query: CommissionQueryDto) {
    return this.payments.commissions(user, query);
  }
}

@ApiTags('Back-office: Billing')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoPaymentsView)
@Controller('backoffice/billing')
export class BackofficeBillingController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('payments')
  list(@CurrentUser() user: SessionUser, @Query() query: PaymentQueryDto) {
    return this.payments.list(user, query);
  }

  @Get('payments/:id')
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.detail(user, id);
  }

  @Get('commissions')
  commissions(@CurrentUser() user: SessionUser, @Query() query: CommissionQueryDto) {
    return this.payments.commissions(user, query);
  }
}
