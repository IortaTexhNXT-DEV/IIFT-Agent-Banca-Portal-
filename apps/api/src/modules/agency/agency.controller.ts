import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import {
  AgencyQueryDto,
  AgentContactDto,
  AgentQueryDto,
  AgentStatusChangeDto,
  BackofficeRegisterAgentDto,
  CreateAgencyDto,
  ReasonDto,
  RegisterAgentDto,
  UpdateAgencyDto,
  UpdateAgentDto,
} from './agency.dto.js';
import { AgenciesService } from './agencies.service.js';
import { AgentsService } from './agents.service.js';

@ApiTags('Back-office: Agencies')
@ForAudience('BACKOFFICE')
@Controller('backoffice/agencies')
export class AgenciesController {
  constructor(private readonly agencies: AgenciesService) {}

  @Get()
  @RequirePermissions(Permission.BoAgenciesView)
  list(@Query() query: AgencyQueryDto) {
    return this.agencies.list(query);
  }

  @Get('options')
  options() {
    return this.agencies.options();
  }

  @Get(':id')
  @RequirePermissions(Permission.BoAgenciesView)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.agencies.get(id);
  }

  @Post()
  @RequirePermissions(Permission.BoAgenciesManage)
  create(@Body() body: CreateAgencyDto) {
    return this.agencies.create(body);
  }

  @Put(':id')
  @RequirePermissions(Permission.BoAgenciesManage)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: UpdateAgencyDto) {
    return this.agencies.update(id, body);
  }

  @Post(':id/lift-block')
  @HttpCode(200)
  @RequirePermissions(Permission.BoAgenciesManage)
  liftBlock(@Param('id', ParseUUIDPipe) id: string, @Body() body: ReasonDto) {
    return this.agencies.liftIssuanceBlock(id, body.reason);
  }
}

@ApiTags('Back-office: Agents')
@ForAudience('BACKOFFICE')
@Controller('backoffice/agents')
export class BackofficeAgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get()
  @RequirePermissions(Permission.BoAgentsView)
  search(@Query() query: AgentQueryDto) {
    return this.agents.search(query);
  }

  @Get(':id')
  @RequirePermissions(Permission.BoAgentsView)
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.agents.detail(id);
  }

  @Post()
  @RequirePermissions(Permission.BoAgentsManage)
  register(@CurrentUser() user: SessionUser, @Body() body: BackofficeRegisterAgentDto) {
    return this.agents.register(user, body);
  }

  @Post(':id/update-requests')
  @RequirePermissions(Permission.BoAgentsManage)
  requestUpdate(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAgentDto,
  ) {
    return this.agents.requestProfileUpdate(user, id, body);
  }

  @Post(':id/status-requests')
  @RequirePermissions(Permission.BoAgentsManage)
  requestStatusChange(@Param('id', ParseUUIDPipe) id: string, @Body() body: AgentStatusChangeDto) {
    return this.agents.requestStatusChange(id, body);
  }
}

@ApiTags('Portal: Profile & agency')
@ForAudience('PORTAL')
@Controller('portal')
export class PortalAgencyController {
  constructor(
    private readonly agents: AgentsService,
    private readonly agencies: AgenciesService,
    private readonly scopes: DataScopeService,
  ) {}

  @Get('profile')
  @RequirePermissions(Permission.PortalProfileView)
  profile(@CurrentUser() user: SessionUser) {
    return this.agents.ownProfile(user);
  }

  @Post('profile/update-requests')
  @RequirePermissions(Permission.PortalProfileUpdate)
  requestUpdate(@CurrentUser() user: SessionUser, @Body() body: AgentContactDto) {
    return this.agents.requestProfileUpdate(user, user.agentId!, body);
  }

  @Get('agency')
  @RequirePermissions(Permission.PortalProfileView)
  agency(@CurrentUser() user: SessionUser) {
    return this.agencies.get(user.agencyId!);
  }

  @Get('hierarchy')
  @RequirePermissions(Permission.PortalHierarchyView)
  hierarchy(@CurrentUser() user: SessionUser) {
    return this.agents.hierarchy(user);
  }

  @Get('agents')
  @RequirePermissions(Permission.PortalHierarchyView)
  async team(@CurrentUser() user: SessionUser, @Query() query: AgentQueryDto) {
    const scope = await this.scopes.resolve(user);
    return this.agents.search(query, { agencyId: scope.agencyId, agentIds: scope.agentIds });
  }

  @Get('agents/:id')
  @RequirePermissions(Permission.PortalHierarchyView)
  async teamMember(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    const scope = await this.scopes.resolve(user);
    const agent = await this.agents.detail(id);
    if (agent.agencyId !== scope.agencyId || (scope.agentIds && !scope.agentIds.includes(id))) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This agent is outside your hierarchy',
      });
    }
    const { screenings: _screenings, ...visible } = agent;
    return visible;
  }

  @Post('agents')
  @RequirePermissions(Permission.PortalAgentRegister)
  register(@CurrentUser() user: SessionUser, @Body() body: RegisterAgentDto) {
    return this.agents.register(user, body);
  }
}
