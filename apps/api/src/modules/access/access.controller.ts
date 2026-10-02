import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { PERMISSION_CATALOGUE, Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import {
  CreateRoleDto,
  CreateStaffUserDto,
  RoleDto,
  UpdateUserDto,
  UserQueryDto,
  UserStatusDto,
} from './access.dto.js';
import { RolesService } from './roles.service.js';
import { UsersService } from './users.service.js';

@ApiTags('Back-office: Users')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoUsersManage)
@Controller('backoffice/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: UserQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post()
  create(@Body() body: CreateStaffUserDto) {
    return this.users.createStaff(body);
  }

  @Patch(':id')
  update(
    @CurrentUser() actor: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
  ) {
    return this.users.update(actor, id, body);
  }

  @Put(':id/status')
  setStatus(
    @CurrentUser() actor: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UserStatusDto,
  ) {
    return this.users.setStatus(actor, id, body.status);
  }

  @Post(':id/unlock')
  @HttpCode(200)
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.unlock(id);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  resetPassword(@CurrentUser() actor: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(actor, id);
  }
}

@ApiTags('Back-office: Roles')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoRolesManage)
@Controller('backoffice/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  list() {
    return this.roles.list();
  }

  @Get('permissions')
  permissions() {
    return PERMISSION_CATALOGUE;
  }

  @Post()
  create(@Body() body: CreateRoleDto) {
    return this.roles.create(body);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: RoleDto) {
    return this.roles.update(id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.roles.remove(id);
  }
}

/** Role list for user assignment drop-downs (user managers may not manage roles). */
@ApiTags('Back-office: Users')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoUsersManage)
@Controller('backoffice/role-options')
export class RoleOptionsController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  async list() {
    const roles = await this.roles.list();
    return roles.map(({ id, code, name, audience }) => ({ id, code, name, audience }));
  }
}
