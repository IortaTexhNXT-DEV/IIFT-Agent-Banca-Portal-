import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { UserStatus, UserType } from '../../generated/prisma/enums.js';

const MOBILE = /^\+?[0-9]{7,15}$/;

export class UserQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: Object.values(UserType) })
  @IsOptional()
  @IsIn(Object.values(UserType))
  userType?: UserType;
  @ApiPropertyOptional({ enum: Object.values(UserStatus) })
  @IsOptional()
  @IsIn(Object.values(UserStatus))
  status?: UserStatus;
}

export class CreateStaffUserDto {
  @ApiProperty() @IsString() @Matches(/^[a-z0-9._-]{3,64}$/i) username: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MOBILE) mobile?: string;
  @ApiProperty({ enum: ['LOCAL', 'DIRECTORY'] }) @IsIn(['LOCAL', 'DIRECTORY']) authSource:
    'LOCAL' | 'DIRECTORY';
  @ApiProperty() @IsArray() @ArrayMaxSize(20) @IsUUID('all', { each: true }) roleIds: string[];
}

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MOBILE) mobile?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  roleIds?: string[];
}

export class UserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'DISABLED'] }) @IsIn(['ACTIVE', 'DISABLED']) status:
    'ACTIVE' | 'DISABLED';
}

export class RoleDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(100) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
  @ApiProperty() @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissions: string[];
}

export class CreateRoleDto extends RoleDto {
  @ApiProperty() @IsString() @Matches(/^[A-Z][A-Z0-9_]{2,49}$/) code: string;
  @ApiProperty({ enum: ['PORTAL', 'BACKOFFICE'] }) @IsIn(['PORTAL', 'BACKOFFICE']) audience:
    'PORTAL' | 'BACKOFFICE';
}
