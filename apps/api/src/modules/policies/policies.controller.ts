import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { PoliciesService } from './policies.service.js';
import {
  CalculateQuoteDto,
  CancellationDto,
  CreateQuotationDto,
  EmailDocumentsDto,
  EndorsementDto,
  NomineesDto,
  PolicyQueryDto,
  QuestionnaireDto,
  QuoteOptionsDto,
} from './policy.dto.js';

@ApiTags('Portal: Quotations & policies')
@ForAudience('PORTAL')
@Controller('portal/policies')
export class PortalPoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @RequirePermissions(Permission.PortalPoliciesView)
  search(@CurrentUser() user: SessionUser, @Query() query: PolicyQueryDto) {
    return this.policies.search(user, query);
  }

  @Get('renewals-due')
  @RequirePermissions(Permission.PortalPoliciesView)
  renewalsDue(@CurrentUser() user: SessionUser, @Query() query: PolicyQueryDto) {
    return this.policies.renewalsDue(user, query);
  }

  @Get(':id')
  @RequirePermissions(Permission.PortalPoliciesView)
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policies.detail(user, id);
  }

  @Post('calculate')
  @HttpCode(200)
  @RequirePermissions(Permission.PortalPoliciesQuote)
  calculate(@CurrentUser() user: SessionUser, @Body() body: CalculateQuoteDto) {
    return this.policies.calculate(user, body);
  }

  @Post()
  @RequirePermissions(Permission.PortalPoliciesQuote)
  create(@CurrentUser() user: SessionUser, @Body() body: CreateQuotationDto) {
    return this.policies.createQuotation(user, body);
  }

  @Put(':id')
  @RequirePermissions(Permission.PortalPoliciesQuote)
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: QuoteOptionsDto,
  ) {
    return this.policies.updateQuotation(user, id, body);
  }

  @Put(':id/questionnaire')
  @RequirePermissions(Permission.PortalPoliciesQuote)
  questionnaire(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: QuestionnaireDto,
  ) {
    return this.policies.saveQuestionnaire(user, id, body.answers);
  }

  @Put(':id/nominees')
  @RequirePermissions(Permission.PortalPoliciesQuote)
  async nominees(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: NomineesDto,
  ) {
    return { count: await this.policies.saveNominees(user, id, body.nominees) };
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions(Permission.PortalPoliciesSubmit)
  submit(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policies.submit(user, id);
  }

  @Post(':id/discard')
  @HttpCode(204)
  @RequirePermissions(Permission.PortalPoliciesQuote)
  discard(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policies.discardQuotation(user, id);
  }

  @Post(':id/reopen')
  @HttpCode(204)
  @RequirePermissions(Permission.PortalPoliciesQuote)
  reopen(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policies.reopen(user, id);
  }

  @Post(':id/renew')
  @RequirePermissions(Permission.PortalPoliciesService)
  renew(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policies.renew(user, id);
  }

  @Post(':id/endorsements')
  @RequirePermissions(Permission.PortalPoliciesService)
  endorse(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EndorsementDto,
  ) {
    return this.policies.requestEndorsement(user, id, body);
  }

  @Post(':id/cancellations')
  @RequirePermissions(Permission.PortalPoliciesService)
  cancel(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancellationDto,
  ) {
    return this.policies.requestCancellation(user, id, body);
  }

  @Post(':id/email-documents')
  @HttpCode(200)
  @RequirePermissions(Permission.PortalPoliciesView)
  emailDocuments(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmailDocumentsDto,
  ) {
    return this.policies.emailDocuments(user, id, body.email);
  }
}

@ApiTags('Back-office: Policies')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoPoliciesView)
@Controller('backoffice/policies')
export class BackofficePoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  search(@CurrentUser() user: SessionUser, @Query() query: PolicyQueryDto) {
    return this.policies.search(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.policies.detail(user, id);
  }

  @Post(':id/email-documents')
  @HttpCode(200)
  emailDocuments(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EmailDocumentsDto,
  ) {
    return this.policies.emailDocuments(user, id, body.email);
  }
}
