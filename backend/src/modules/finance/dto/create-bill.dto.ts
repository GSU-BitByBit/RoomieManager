import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';

export class CreateBillSplitDto {
  @ApiProperty({
    example: 'f5c6304d-7f58-4f67-bf80-4de6f388b310',
    description: 'User id for this split row.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
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
  currency?: string;

  @ApiProperty({
    example: 'f5c6304d-7f58-4f67-bf80-4de6f388b310',
    description: 'User id of the member who paid this bill.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
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
    description: 'Optional due date for this bill.'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @ApiProperty({
    type: () => [CreateBillSplitDto],
    description: 'Split rows. Amounts must sum exactly to totalAmount.'
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateBillSplitDto)
  splits!: CreateBillSplitDto[];
}
