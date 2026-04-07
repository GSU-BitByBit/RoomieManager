import { ChoreTemplateAssignmentStrategy } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

import { transformDateOnlyValue } from '../../../common/time/date-only.util';

export class CreateChoreTemplateDto {
  @ApiProperty({
    example: 'Take out trash',
    minLength: 1,
    maxLength: 120,
    description: 'Template title for a recurring interval-based chore.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({
    example: 'Kitchen and bathroom bins.',
    maxLength: 1000
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    enum: ChoreTemplateAssignmentStrategy,
    enumName: 'ChoreTemplateAssignmentStrategy',
    description: 'Assignment mode for generated occurrences.'
  })
  @IsEnum(ChoreTemplateAssignmentStrategy)
  assignmentStrategy!: ChoreTemplateAssignmentStrategy;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-04-06',
    description: 'First due occurrence date (YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsDate()
  startsOn!: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-06-29',
    description: 'Optional inclusive final due occurrence date (YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsOptional()
  @IsDate()
  endsOn?: Date;

  @ApiProperty({
    type: Number,
    example: 7,
    minimum: 1,
    description: 'Positive day interval between due occurrences.'
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  repeatEveryDays!: number;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Required when assignmentStrategy is FIXED.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2', 'user-uuid-3'],
    description: 'Required when assignmentStrategy is ROUND_ROBIN. Order determines rotation order.'
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((entry) => (typeof entry === 'string' ? entry.trim() : entry))
      : value
  )
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  participantUserIds?: string[];
}
