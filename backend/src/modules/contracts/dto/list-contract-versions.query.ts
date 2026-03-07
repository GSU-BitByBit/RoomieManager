import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

import {
  PaginationQueryDto,
  SORT_ORDER_VALUES,
  type SortOrder
} from '../../../common/http/dto/pagination-query.dto';

const CONTRACT_VERSION_SORT_BY_VALUES = ['version', 'createdAt'] as const;
export type ContractVersionSortBy = (typeof CONTRACT_VERSION_SORT_BY_VALUES)[number];

export class ListContractVersionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: CONTRACT_VERSION_SORT_BY_VALUES,
    description: 'Optional sort field for contract versions.',
    default: 'version'
  })
  @IsOptional()
  @IsIn(CONTRACT_VERSION_SORT_BY_VALUES)
  sortBy: ContractVersionSortBy = 'version';

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
