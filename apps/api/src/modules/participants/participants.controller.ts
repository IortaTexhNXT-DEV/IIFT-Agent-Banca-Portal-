import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import {
  CreateParticipantDto,
  ParticipantLookupDto,
  ParticipantQueryDto,
  UpdateParticipantDto,
} from './participant.dto.js';
import { ParticipantsService } from './participants.service.js';

@ApiTags('Portal: Participants')
@ForAudience('PORTAL')
@Controller('portal/participants')
export class PortalParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  @RequirePermissions(Permission.PortalParticipantsView)
  search(@CurrentUser() user: SessionUser, @Query() query: ParticipantQueryDto) {
    return this.participants.search(user, query);
  }

  @Get('lookup')
  @RequirePermissions(Permission.PortalParticipantsManage)
  lookup(@Query() query: ParticipantLookupDto) {
    return this.participants.lookup(query.idType, query.idNumber);
  }

  @Get(':id')
  @RequirePermissions(Permission.PortalParticipantsView)
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.participants.detail(user, id);
  }

  @Post()
  @RequirePermissions(Permission.PortalParticipantsManage)
  create(@CurrentUser() user: SessionUser, @Body() body: CreateParticipantDto) {
    return this.participants.create(user, body);
  }

  @Post(':id/update-requests')
  @RequirePermissions(Permission.PortalParticipantsManage)
  requestUpdate(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateParticipantDto,
  ) {
    return this.participants.requestUpdate(user, id, body);
  }
}

@ApiTags('Back-office: Participants')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoParticipantsView)
@Controller('backoffice/participants')
export class BackofficeParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get()
  search(@CurrentUser() user: SessionUser, @Query() query: ParticipantQueryDto) {
    return this.participants.search(user, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.participants.detail(user, id);
  }

  @Post(':id/update-requests')
  requestUpdate(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateParticipantDto,
  ) {
    return this.participants.requestUpdate(user, id, body);
  }
}
