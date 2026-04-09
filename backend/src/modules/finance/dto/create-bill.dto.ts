import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

const ISO_CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export class CreateBillSplitDto {
  @ApiProperty({
    example: 'f5c6304d-7f58-4f67-bf80-4de6f388b310',
    description: 'User id for this split row.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  userId!: string;

  @ApiProperty({
    example: 25.5,
    description: 'Amount this user owes for the bill. Supports up to 2 decimal places.'
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class CreateBillDto {
  @ApiProperty({
    example: 'Internet bill - March',
    minLength: 1,
    maxLength: 160,
    description: 'Short bill title.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional({
    example: 'Monthly ISP payment',
    maxLength: 2_000,
    description: 'Optional bill description.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  description?: string;

  @ApiProperty({
    example: 76.5,
    description: 'Total bill amount. Supports up to 2 decimal places.'
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  totalAmount!: number;

  @ApiPropertyOptional({
    example: 'USD',
    description: 'Three-letter ISO currency code. Defaults to USD.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(ISO_CURRENCY_CODE_PATTERN, {
    message: 'currency must be a valid three-letter ISO currency code.'
  })
  currency?: string;

  @ApiProperty({
    example: 'f5c6304d-7f58-4f67-bf80-4de6f388b310',
    description: 'User id of the member who paid this bill.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  paidByUserId!: string;

  @ApiPropertyOptional({
    example: '2026-03-05T18:00:00.000Z',
    description: 'When the bill was incurred. Defaults to now.'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  incurredAt?: Date;

  @ApiPropertyOptional({
    example: '2026-03-15T18:00:00.000Z',
    description:
      'Optional informational due date for this bill. It is not currently used for balance math, reminders, or settlement logic.'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @ApiProperty({
    type: () => [CreateBillSplitDto],
    description:
      'Explicit custom split rows. Amounts must sum exactly to totalAmount. Equal splitting is a frontend convenience that still submits explicit custom split rows.'
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((split: CreateBillSplitDto) => split.userId)
  @ValidateNested({ each: true })
  @Type(() => CreateBillSplitDto)
  splits!: CreateBillSplitDto[];
}
