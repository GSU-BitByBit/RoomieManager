import { ChoreStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

import {
  PaginationQueryDto,
  SORT_ORDER_VALUES,
  type SortOrder
} from '../../../common/http/dto/pagination-query.dto';
import { transformDateOnlyValue } from '../../../common/time/date-only.util';

const CHORE_SORT_BY_VALUES = ['dueOn', 'createdAt', 'updatedAt', 'status'] as const;
export type ChoreSortBy = (typeof CHORE_SORT_BY_VALUES)[number];

export class ListChoresQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ChoreStatus,
    enumName: 'ChoreStatus',
    description: 'Optional filter by occurrence status.'
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
    example: '2026-03-10',
    description: 'Optional lower bound for dueOn (inclusive, YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsOptional()
  @IsDate()
  dueOnFrom?: Date;

  @ApiPropertyOptional({
    example: '2026-03-20',
    description: 'Optional upper bound for dueOn (inclusive, YYYY-MM-DD).'
  })
  @Transform(({ value }) => transformDateOnlyValue(value))
  @IsOptional()
  @IsDate()
  dueOnTo?: Date;

  @ApiPropertyOptional({
    enum: CHORE_SORT_BY_VALUES,
    description: 'Optional sort field for chore listing.',
    default: 'dueOn'
  })
  @IsOptional()
  @IsIn(CHORE_SORT_BY_VALUES)
  sortBy: ChoreSortBy = 'dueOn';

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
