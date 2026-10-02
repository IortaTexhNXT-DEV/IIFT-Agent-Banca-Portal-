import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { IssuePriority, IssueStatus } from '../../generated/prisma/enums.js';
import { IssuesService } from './issues.service.js';

const PRIORITIES = Object.values(IssuePriority);
const STATUSES = Object.values(IssueStatus);
const toBoolean = ({ value }: { value: unknown }) => value === 'true' || value === true;

class CreateIssueDto {
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(200) title: string;
  @ApiProperty() @IsString() @MinLength(10) @MaxLength(4000) description: string;
  @ApiProperty() @IsString() @MaxLength(50) category: string;
  @ApiProperty({ enum: PRIORITIES }) @IsIn(PRIORITIES) priority: IssuePriority;
}

class IssueQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: IssueStatus;
  @ApiPropertyOptional({ enum: PRIORITIES })
  @IsOptional()
  @IsIn(PRIORITIES)
  priority?: IssuePriority;
  @ApiPropertyOptional() @IsOptional() @Transform(toBoolean) @IsBoolean() assignedToMe?: boolean;
  @ApiPropertyOptional() @IsOptional() @Transform(toBoolean) @IsBoolean() breachedOnly?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
}

class CommentDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) body: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() internal?: boolean;
}

class StatusDto {
  @ApiProperty({ enum: STATUSES }) @IsIn(STATUSES) status: IssueStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) resolution?: string;
}

class AssignDto {
  @ApiProperty() @IsUUID() assigneeId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) team?: string;
}

class PriorityDto {
  @ApiProperty({ enum: PRIORITIES }) @IsIn(PRIORITIES) priority: IssuePriority;
}

/** Shared by portal and back-office users; back-office managers see and manage all issues. */
@ApiTags('Common: Issues')
@Controller('common/issues')
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: IssueQueryDto) {
    return this.issues.list(user, query, query);
  }

  @Get(':id')
  detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.issues.detail(user, id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() body: CreateIssueDto) {
    return this.issues.create(user, body);
  }

  @Post(':id/comments')
  comment(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CommentDto,
  ) {
    return this.issues.comment(user, id, body.body, body.internal ?? false);
  }

  @Put(':id/status')
  setStatus(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: StatusDto,
  ) {
    return this.issues.setStatus(user, id, body.status, body.resolution);
  }
}

@ApiTags('Back-office: Issues')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoIssuesManage)
@Controller('backoffice/issues')
export class IssueManagementController {
  constructor(private readonly issues: IssuesService) {}

  @Get('assignees')
  assignees() {
    return this.issues.assignees();
  }

  @Put(':id/assignment')
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() body: AssignDto) {
    return this.issues.assign(id, body.assigneeId, body.team);
  }

  @Put(':id/priority')
  setPriority(@Param('id', ParseUUIDPipe) id: string, @Body() body: PriorityDto) {
    return this.issues.setPriority(id, body.priority);
  }
}
