import { Global, Module } from '@nestjs/common';
import { RoleOptionsController, RolesController, UsersController } from './access.controller.js';
import { RolesService } from './roles.service.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  controllers: [UsersController, RolesController, RoleOptionsController],
  providers: [UsersService, RolesService],
  exports: [UsersService],
})
export class AccessModule {}
