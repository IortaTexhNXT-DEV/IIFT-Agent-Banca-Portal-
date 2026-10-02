import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { CurrentUser } from '../../common/security/decorators.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { NotificationsService } from './notifications.service.js';

class NotificationQueryDto extends PageQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  unreadOnly?: boolean;
}

/** In-app notifications of the signed-in user (portal and back-office). */
@ApiTags('Common: Notifications')
@Controller('common/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: NotificationQueryDto) {
    return this.notifications.listForUser(user.id, query, query.unreadOnly ?? false);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: SessionUser) {
    return { count: await this.notifications.unreadCount(user.id) };
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Post('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: SessionUser) {
    return this.notifications.markAllRead(user.id);
  }
}
