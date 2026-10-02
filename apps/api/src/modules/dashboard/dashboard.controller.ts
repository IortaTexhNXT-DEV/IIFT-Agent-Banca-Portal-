import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('Portal: Dashboard')
@ForAudience('PORTAL')
@RequirePermissions(Permission.PortalDashboard)
@Controller('portal/dashboard')
export class PortalDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: SessionUser) {
    return this.dashboard.portal(user);
  }
}

@ApiTags('Back-office: Dashboard')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoDashboard)
@Controller('backoffice/dashboard')
export class BackofficeDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentUser() user: SessionUser) {
    return this.dashboard.backoffice(user);
  }
}
