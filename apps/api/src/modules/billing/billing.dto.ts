import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination.js';
import { PaymentMethod, PaymentStatus } from '../../generated/prisma/enums.js';

export class AllocationDto {
  @ApiProperty() @IsUUID() policyId: string;
  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount: number;
}

/**
 * Multipart form: the proof file plus these fields. `allocations` arrives as a JSON
 * string in the form and is parsed into validated objects.
 */
export class SubmitPaymentDto {
  @ApiProperty({ enum: Object.values(PaymentMethod) })
  @IsIn(Object.values(PaymentMethod))
  method: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) bankName?: string;
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9\-/ ]{3,50}$/) referenceNo: string;
  @ApiProperty() @IsISO8601({ strict: true }) paymentDate: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;

  @ApiProperty({ type: String, description: 'JSON array of { policyId, amount }' })
  @Transform(({ value }) => {
    try {
      return plainToInstance(AllocationDto, typeof value === 'string' ? JSON.parse(value) : value);
    } catch {
      return value;
    }
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AllocationDto)
  allocations: AllocationDto[];
}

export class PaymentQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: Object.values(PaymentStatus) })
  @IsOptional()
  @IsIn(Object.values(PaymentStatus))
  status?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() agencyId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) search?: string;
}

export class CommissionQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ example: '2026-10' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/)
  period?: string;
}
