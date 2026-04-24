import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

const allowedEmailActionTypes = [
  'email',
  'signup',
  'recovery',
  'magiclink',
  'invite',
  'email_change'
] as const;

export class ExchangeEmailActionDto {
  @ApiProperty({ example: '<token-hash-from-supabase-email-link>' })
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  tokenHash!: string;

  @ApiProperty({
    example: 'recovery',
    enum: allowedEmailActionTypes
  })
  @IsString()
  @IsIn(allowedEmailActionTypes)
  type!: (typeof allowedEmailActionTypes)[number];
}
