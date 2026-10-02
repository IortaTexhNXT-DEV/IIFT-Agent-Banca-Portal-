import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import {
  AgencyStatus,
  AgentStatus,
  AgentType,
  Channel,
  IdType,
} from '../../generated/prisma/enums.js';

export const MOBILE_PATTERN = /^\+?[0-9]{7,15}$/;
export const ID_NUMBER_PATTERN = /^[A-Za-z0-9-/ ]{5,30}$/;

export class AgencyQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: Object.values(Channel) })
  @IsOptional()
  @IsIn(Object.values(Channel))
  channel?: Channel;
  @ApiPropertyOptional({ enum: Object.values(AgencyStatus) })
  @IsOptional()
  @IsIn(Object.values(AgencyStatus))
  status?: AgencyStatus;
}

export class AgencyDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) registrationNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MOBILE_PATTERN) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
}

export class CreateAgencyDto extends AgencyDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z0-9-]{2,20}$/) code: string;
  @ApiProperty({ enum: Object.values(Channel) }) @IsIn(Object.values(Channel)) channel: Channel;
}

export class UpdateAgencyDto extends AgencyDto {
  @ApiProperty({ enum: Object.values(AgencyStatus) })
  @IsIn(Object.values(AgencyStatus))
  status: AgencyStatus;
}

export class ReasonDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(300) reason: string;
}

export class AgentQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) idNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agencyId?: string;
  @ApiPropertyOptional({ enum: Object.values(Channel) })
  @IsOptional()
  @IsIn(Object.values(Channel))
  channel?: Channel;
  @ApiPropertyOptional({ enum: Object.values(AgentStatus) })
  @IsOptional()
  @IsIn(Object.values(AgentStatus))
  status?: AgentStatus;
  @ApiPropertyOptional({ enum: Object.values(AgentType) })
  @IsOptional()
  @IsIn(Object.values(AgentType))
  agentType?: AgentType;
}

/** Fields an agent may change about themselves (AP-06), subject to approval. */
export class AgentContactDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MOBILE_PATTERN) mobile?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) branchName?: string;
}

/** Back-office profile maintenance (BO-05/08), subject to approval. */
export class UpdateAgentDto extends AgentContactDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) dateOfBirth?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) licenceNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) licenceExpiry?: string;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  authorityLimit?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsUUID()
  parentAgentId?: string | null;
}

export class RegisterAgentDto {
  @ApiProperty({ enum: Object.values(AgentType) })
  @IsIn(Object.values(AgentType))
  agentType: AgentType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentAgentId?: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @ApiProperty({ enum: ['NRIC', 'PASSPORT'] }) @IsIn(['NRIC', 'PASSPORT']) idType: Extract<
    IdType,
    'NRIC' | 'PASSPORT'
  >;
  @ApiProperty() @Matches(ID_NUMBER_PATTERN) idNumber: string;
  @ApiProperty() @IsISO8601({ strict: true }) dateOfBirth: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty() @Matches(MOBILE_PATTERN) mobile: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) branchName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) licenceNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) licenceExpiry?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  authorityLimit?: number;
}

export class BackofficeRegisterAgentDto extends RegisterAgentDto {
  @ApiProperty() @IsUUID() agencyId: string;
}

export class AgentStatusChangeDto {
  @ApiProperty({ enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'] })
  @IsIn(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED'])
  status: Extract<AgentStatus, 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'TERMINATED'>;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(300) reason: string;
}
