import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

import { transformDateOnlyValue } from '../../../common/time/date-only.util';

export class CreateChoreDto {
  @ApiProperty({
    example: 'Take out trash',
    minLength: 1,
    maxLength: 120,
    description: 'Short, human-readable chore title'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    example: 'Take out kitchen and bathroom trash before 9pm.',
    maxLength: 1000
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-03-10',
    description: 'Required date-only due slot for the chore (YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsDate()
  dueOn!: Date;

  @ApiProperty({
    example: 'user-uuid',
    description: 'Required active group member who will own this one-off chore.'
  })
  @IsString()
  assigneeUserId!: string;
}
