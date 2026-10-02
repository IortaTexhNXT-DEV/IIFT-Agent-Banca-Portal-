import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { AmlStatus, IdType, ParticipantType } from '../../generated/prisma/enums.js';
import { ID_NUMBER_PATTERN, MOBILE_PATTERN } from '../agency/agency.dto.js';

export class ParticipantContactDto {
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(MOBILE_PATTERN) mobile?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  addressLine1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Za-z0-9 ]{2,10}$/) postcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) occupation?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(4) occupationClass?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nationality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) contactPerson?: string;
}

export class UpdateParticipantDto extends ParticipantContactDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(150) fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) dateOfBirth?: string;
}

export class CreateParticipantDto {
  @ApiProperty({ enum: Object.values(ParticipantType) })
  @IsIn(Object.values(ParticipantType))
  type: ParticipantType;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @ApiProperty({ enum: Object.values(IdType) }) @IsIn(Object.values(IdType)) idType: IdType;
  @ApiProperty() @Matches(ID_NUMBER_PATTERN) idNumber: string;
  @ApiPropertyOptional()
  @ValidateIf((o: CreateParticipantDto) => o.type === 'INDIVIDUAL')
  @IsISO8601({ strict: true })
  dateOfBirth?: string;
  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE'] })
  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  gender?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) nationality?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) occupation?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(4) occupationClass?: number;
  @ApiPropertyOptional() @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @ApiProperty() @Matches(MOBILE_PATTERN) mobile: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(200) addressLine1: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) addressLine2?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Za-z0-9 ]{2,10}$/) postcode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) contactPerson?: string;
}

export class ParticipantQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) search?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) idNumber?: string;
  @ApiPropertyOptional({ enum: Object.values(ParticipantType) })
  @IsOptional()
  @IsIn(Object.values(ParticipantType))
  type?: ParticipantType;
  @ApiPropertyOptional({ enum: Object.values(AmlStatus) })
  @IsOptional()
  @IsIn(Object.values(AmlStatus))
  amlStatus?: AmlStatus;
}

export class ParticipantLookupDto {
  @ApiProperty({ enum: Object.values(IdType) }) @IsIn(Object.values(IdType)) idType: IdType;
  @ApiProperty() @Matches(ID_NUMBER_PATTERN) idNumber: string;
}
