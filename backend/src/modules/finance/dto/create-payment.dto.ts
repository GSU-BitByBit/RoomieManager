import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  Min,
  MinLength
} from 'class-validator';

const ISO_CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;
const APP_ID_PATTERN =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|c[a-z0-9]{8,})$/i;

export class CreatePaymentDto {
  @ApiProperty({
    example: 'f5c6304d-7f58-4f67-bf80-4de6f388b310',
    description: 'User id of the member sending payment.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  payerUserId!: string;

  @ApiProperty({
    example: '8e9f7f6e-e3b4-468f-a8f4-c35159b844ab',
    description: 'User id of the member receiving payment.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsUUID()
  payeeUserId!: string;

  @ApiProperty({
    example: 20,
    description: 'Payment amount. Supports up to 2 decimal places.'
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

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

  @ApiPropertyOptional({
    example: '3e4f66fd-7eeb-4c2f-a98e-f94376ea22f5',
    description:
      'Optional related bill id for reference only. Must belong to the same group and use the same currency when provided.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @Matches(APP_ID_PATTERN, {
    message: 'billId must be a valid uuid or cuid.'
  })
  billId?: string;

  @ApiPropertyOptional({
    example: 'Paid via Zelle',
    maxLength: 1_000,
    description: 'Optional payment note.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  note?: string;

  @ApiPropertyOptional({
    example: 'pay-2026-03-05-group1-user1-user2-20',
    maxLength: 64,
    description:
      'Optional idempotency key for safely retried payment requests. Reusing the same key with a different payment payload will return a conflict.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  idempotencyKey?: string;

  @ApiPropertyOptional({
    example: '2026-03-05T18:15:00.000Z',
    description: 'When payment was made. Defaults to now.'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  paidAt?: Date;
}
