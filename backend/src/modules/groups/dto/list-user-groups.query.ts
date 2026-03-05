import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

import {
  PaginationQueryDto,
  SORT_ORDER_VALUES,
  type SortOrder
} from '../../../common/http/dto/pagination-query.dto';

const USER_GROUP_SORT_BY_VALUES = ['updatedAt', 'createdAt', 'name', 'joinedAt'] as const;
export type UserGroupSortBy = (typeof USER_GROUP_SORT_BY_VALUES)[number];

export class ListUserGroupsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: USER_GROUP_SORT_BY_VALUES,
    description: 'Optional sort field for current-user group listing.',
    default: 'updatedAt'
  })
  @IsOptional()
  @IsIn(USER_GROUP_SORT_BY_VALUES)
  sortBy: UserGroupSortBy = 'updatedAt';

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
