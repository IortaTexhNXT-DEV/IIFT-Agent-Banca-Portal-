import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import { CurrentUser, ForAudience, RequirePermissions } from '../../common/security/decorators.js';
import { Permission } from '../../common/security/permissions.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { ApprovalStatus, ApprovalType } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { WorkflowService } from './workflow.service.js';

const TYPES = Object.values(ApprovalType);
const STATUSES = Object.values(ApprovalStatus);

class DecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) remarks?: string;
}

class RejectDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(1000) remarks: string;
}

class InboxQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: TYPES }) @IsOptional() @IsIn(TYPES) type?: ApprovalType;
}

class SearchQueryDto extends InboxQueryDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: ApprovalStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) requestNo?: string;
}

class MyRequestsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: STATUSES }) @IsOptional() @IsIn(STATUSES) status?: ApprovalStatus;
}

class WorkflowStepDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiProperty() @IsString() permission: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minAmount?:
    number | null;
}

class UpdateWorkflowDto {
  @ApiProperty() @IsBoolean() active: boolean;
  @ApiProperty({ type: [WorkflowStepDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[];
}

/** BO-16..19, BO-21: approval inbox and decisions (checker side). */
@ApiTags('Back-office: Approvals')
@ForAudience('BACKOFFICE')
@Controller('backoffice/approvals')
export class ApprovalsController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get('inbox')
  inbox(@CurrentUser() user: SessionUser, @Query() query: InboxQueryDto) {
    return this.workflow.inbox(user, query, { type: query.type });
  }

  @Get()
  search(@Query() query: SearchQueryDto) {
    return this.workflow.search(query, query);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.detail(id);
  }

  @Post(':id/approve')
  @HttpCode(200)
  approve(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DecisionDto,
  ) {
    return this.workflow.approve(user, id, body.remarks);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectDto,
  ) {
    return this.workflow.reject(user, id, body.remarks);
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.withdraw(user, id);
  }
}

/** COM-04: workflow configuration by transaction type, level, role and amount. */
@ApiTags('Back-office: Workflow configuration')
@ForAudience('BACKOFFICE')
@RequirePermissions(Permission.BoWorkflowConfigure)
@Controller('backoffice/workflows')
export class WorkflowConfigController {
  constructor(private readonly workflow: WorkflowService) {}

  @Get()
  list() {
    return this.workflow.listDefinitions();
  }

  @Put(':type')
  update(
    @Param('type', new ParseEnumPipe(ApprovalType)) type: ApprovalType,
    @Body() body: UpdateWorkflowDto,
  ) {
    return this.workflow.updateDefinition(type, body.active, body.steps);
  }
}

/** AP-49/50/51: agents track the requests they (or their team) submitted. */
@ApiTags('Portal: Requests')
@ForAudience('PORTAL')
@Controller('portal/requests')
export class PortalRequestsController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly scopes: DataScopeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async mine(@CurrentUser() user: SessionUser, @Query() query: MyRequestsQueryDto) {
    return this.workflow.submittedBy(await this.makerIdsInScope(user), query, query.status);
  }

  @Get(':id')
  async detail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    const request = await this.workflow.detail(id);
    if (!(await this.makerIdsInScope(user)).includes(request.makerId)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You do not have access to this request',
      });
    }
    return request;
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  withdraw(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.withdraw(user, id);
  }

  /** User ids of the portal users whose requests this user may see. */
  private async makerIdsInScope(user: SessionUser): Promise<string[]> {
    const scope = await this.scopes.resolve(user);
    const users = await this.prisma.user.findMany({
      where: {
        agent: {
          agencyId: scope.agencyId,
          id: scope.agentIds ? { in: scope.agentIds } : undefined,
        },
      },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }
}
