import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';

import {
  PaginationQueryDto,
  SORT_ORDER_VALUES,
  type SortOrder
} from '../../../common/http/dto/pagination-query.dto';

const GROUP_MEMBER_SORT_BY_VALUES = ['role', 'joinedAt', 'createdAt'] as const;
export type GroupMemberSortBy = (typeof GROUP_MEMBER_SORT_BY_VALUES)[number];

export class ListGroupMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: GROUP_MEMBER_SORT_BY_VALUES,
    description: 'Optional sort field for group members.',
    default: 'role'
  })
  @IsOptional()
  @IsIn(GROUP_MEMBER_SORT_BY_VALUES)
  sortBy: GroupMemberSortBy = 'role';

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
