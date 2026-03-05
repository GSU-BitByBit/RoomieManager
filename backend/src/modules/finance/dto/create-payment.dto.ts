import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: 'f5c6304d-7f58-4f67-bf80-4de6f388b310',
    description: 'User id of the member sending payment.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  payerUserId!: string;

  @ApiProperty({
    example: '8e9f7f6e-e3b4-468f-a8f4-c35159b844ab',
    description: 'User id of the member receiving payment.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
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
  currency?: string;

  @ApiPropertyOptional({
    example: '3e4f66fd-7eeb-4c2f-a98e-f94376ea22f5',
    description: 'Optional bill id this payment is linked to.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
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
    description: 'Optional idempotency key for safely retried payment requests.'
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
