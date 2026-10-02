import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { NomineeRole, PolicyPaymentStatus, PolicyStatus } from '../../generated/prisma/enums.js';

export class QuoteOptionsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) planCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) coverageType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(600) termMonths?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() additionalCover?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) startDate?: string;
  @ApiProperty({ type: Object }) @IsObject() riskDetails: Record<string, unknown>;
}

export class CreateQuotationDto extends QuoteOptionsDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsUUID() participantId: string;
}

/** Indicative quote without saving (AP-18/19). */
export class CalculateQuoteDto extends QuoteOptionsDto {
  @ApiProperty() @IsUUID() productId: string;
  @ApiProperty() @IsUUID() participantId: string;
}

export class QuestionnaireAnswerDto {
  @ApiProperty() @IsString() @MaxLength(30) code: string;
  @ApiProperty() @IsBoolean() answer: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) details?: string;
}

export class QuestionnaireDto {
  @ApiProperty({ type: [QuestionnaireAnswerDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => QuestionnaireAnswerDto)
  answers: QuestionnaireAnswerDto[];
}

export class NomineeDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(150) fullName: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Za-z0-9-/ ]{5,30}$/) idNumber?: string;
  @ApiProperty() @IsString() @MaxLength(50) relationship: string;
  @ApiProperty({ enum: Object.values(NomineeRole) })
  @IsIn(Object.values(NomineeRole))
  role: NomineeRole;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100) sharePercent: number;
}

export class NomineesDto {
  @ApiProperty({ type: [NomineeDto] })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => NomineeDto)
  nominees: NomineeDto[];
}

export class PolicyQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) search?: string;
  @ApiPropertyOptional({ enum: Object.values(PolicyStatus) })
  @IsOptional()
  @IsIn(Object.values(PolicyStatus))
  status?: PolicyStatus;
  @ApiPropertyOptional({ enum: Object.values(PolicyPaymentStatus) })
  @IsOptional()
  @IsIn(Object.values(PolicyPaymentStatus))
  paymentStatus?: PolicyPaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() productId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601({ strict: true }) to?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  outstandingOnly?: boolean;
}

export class EndorsementDto {
  @ApiProperty() @IsString() @MaxLength(50) endorsementType: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) description: string;
  @ApiPropertyOptional({ type: [NomineeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => NomineeDto)
  nominees?: NomineeDto[];
}

export class CancellationDto {
  @ApiProperty() @IsString() @MaxLength(50) reasonCode: string;
  @ApiProperty() @IsString() @MinLength(5) @MaxLength(1000) remarks: string;
  @ApiProperty() @IsISO8601({ strict: true }) effectiveDate: string;
}

export class EmailDocumentsDto {
  @ApiPropertyOptional({ description: 'Defaults to the participant e-mail address' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  email?: string;
}
