import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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

  @ApiPropertyOptional({
    example: '2026-03-10T21:00:00.000Z',
    description: 'Optional ISO-8601 due date for the chore'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Optional user ID to assign the chore to at creation time'
  })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;
}
