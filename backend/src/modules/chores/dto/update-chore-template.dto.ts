import { ChoreTemplateAssignmentStrategy } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
  MinLength,
  ValidateIf
} from 'class-validator';

import { transformDateOnlyValue } from '../../../common/time/date-only.util';

export class UpdateChoreTemplateDto {
  @ApiPropertyOptional({
    example: 'Take out trash',
    minLength: 1,
    maxLength: 120,
    description: 'Updated title for the recurring template.'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    type: String,
    example: 'Kitchen and bathroom bins.',
    maxLength: 1000,
    nullable: true
  })
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({
    enum: ChoreTemplateAssignmentStrategy,
    enumName: 'ChoreTemplateAssignmentStrategy',
    description: 'Updated assignment mode for future occurrences.'
  })
  @IsOptional()
  @IsEnum(ChoreTemplateAssignmentStrategy)
  assignmentStrategy?: ChoreTemplateAssignmentStrategy;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-04-06',
    description: 'Updated first due occurrence date (YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsOptional()
  @IsDate()
  startsOn?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '2026-06-29',
    description: 'Updated inclusive end date (YYYY-MM-DD). Set null to clear.',
    nullable: true
  })
  @Transform(({ value }) => (value === null ? null : transformDateOnlyValue(value)))
  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsDate()
  endsOn?: Date | null;

  @ApiPropertyOptional({
    type: Number,
    example: 14,
    minimum: 1,
    description: 'Updated day interval between due occurrences.'
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  repeatEveryDays?: number;

  @ApiPropertyOptional({
    type: String,
    example: 'user-uuid',
    description: 'Updated fixed assignee. Only valid for FIXED templates.',
    nullable: true
  })
  @Transform(({ value }) => {
    if (value === null) {
      return null;
    }

    return typeof value === 'string' ? value.trim() : value;
  })
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  assigneeUserId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['user-uuid-1', 'user-uuid-2', 'user-uuid-3'],
    description: 'Updated ordered round-robin participant user IDs.'
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
