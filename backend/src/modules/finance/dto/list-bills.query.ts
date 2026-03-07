import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

import {
  PaginationQueryDto,
  SORT_ORDER_VALUES,
  type SortOrder
} from '../../../common/http/dto/pagination-query.dto';

const BILL_SORT_BY_VALUES = ['incurredAt', 'createdAt', 'totalAmount'] as const;
export type BillSortBy = (typeof BILL_SORT_BY_VALUES)[number];

export class ListBillsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: BILL_SORT_BY_VALUES,
    description: 'Optional sort field for group bills.',
    default: 'incurredAt'
  })
  @IsOptional()
  @IsIn(BILL_SORT_BY_VALUES)
  sortBy: BillSortBy = 'incurredAt';

  @ApiPropertyOptional({
    enum: SORT_ORDER_VALUES,
    description: 'Sort order applied to the selected field.',
    default: 'desc'
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value))
  @IsOptional()
  @IsIn(SORT_ORDER_VALUES)
  sortOrder: SortOrder = 'desc';
}
