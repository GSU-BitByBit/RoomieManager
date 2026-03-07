import { ChoreStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import {
  PaginationQueryDto,
  SORT_ORDER_VALUES,
  type SortOrder
} from '../../../common/http/dto/pagination-query.dto';

const CHORE_SORT_BY_VALUES = ['dueDate', 'createdAt', 'updatedAt', 'status'] as const;
export type ChoreSortBy = (typeof CHORE_SORT_BY_VALUES)[number];

export class ListChoresQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ChoreStatus,
    enumName: 'ChoreStatus',
    description: 'Optional filter by status (PENDING or COMPLETED)'
  })
  @IsOptional()
  @IsEnum(ChoreStatus)
  status?: ChoreStatus;

  @ApiPropertyOptional({
    example: 'user-uuid',
    description: 'Optional filter by assignee user ID'
  })
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @ApiPropertyOptional({
    example: '2026-03-10T00:00:00.000Z',
    description: 'Optional lower bound for due date (inclusive)'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  dueAfter?: Date;

  @ApiPropertyOptional({
    example: '2026-03-20T00:00:00.000Z',
    description: 'Optional upper bound for due date (inclusive)'
  })
  @Transform(({ value }) => (value ? new Date(value) : value))
  @IsOptional()
  @IsDate()
  dueBefore?: Date;

  @ApiPropertyOptional({
    enum: CHORE_SORT_BY_VALUES,
    description: 'Optional sort field for chore listing.',
    default: 'dueDate'
  })
  @IsOptional()
  @IsIn(CHORE_SORT_BY_VALUES)
  sortBy: ChoreSortBy = 'dueDate';

  @ApiPropertyOptional({
    enum: SORT_ORDER_VALUES,
    description: 'Sort order applied to the selected field.',
    default: 'asc'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsOptional()
  @IsIn(SORT_ORDER_VALUES)
  sortOrder: SortOrder = 'asc';
}
