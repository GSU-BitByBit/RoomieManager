import { GroupMemberRole, GroupMemberStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PaginationMetaDto } from '../../../common/http/dto/pagination-meta.dto';

export class GroupSummaryDto {
  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  id!: string;

  @ApiProperty({ example: 'Apartment 12A' })
  name!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  createdBy!: string;

  @ApiProperty({ example: '2026-03-05T16:00:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T16:05:00.000Z', format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ enum: GroupMemberRole, example: GroupMemberRole.ADMIN })
  memberRole!: GroupMemberRole;

  @ApiProperty({ enum: GroupMemberStatus, example: GroupMemberStatus.ACTIVE })
  memberStatus!: GroupMemberStatus;

  @ApiProperty({ example: 3 })
  memberCount!: number;

  @ApiPropertyOptional({ example: 'ABCD1234' })
  joinCode?: string;
}

export class UserGroupsResponseDto {
  @ApiProperty({ type: () => [GroupSummaryDto] })
  groups!: GroupSummaryDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class GroupDashboardMembersSummaryDto {
  @ApiProperty({ example: 3 })
  totalActive!: number;

  @ApiProperty({ example: 1 })
  adminCount!: number;

  @ApiProperty({ example: 2 })
  memberCount!: number;
}

export class GroupDashboardChoresSummaryDto {
  @ApiProperty({ example: 1 })
  overdueCount!: number;

  @ApiProperty({ example: 2 })
  dueTodayCount!: number;

  @ApiProperty({ example: 5 })
  dueNext7DaysCount!: number;

  @ApiProperty({ example: 2 })
  assignedToMeDueNext7DaysCount!: number;
}

export class GroupDashboardFinanceSummaryDto {
  @ApiProperty({ example: 5 })
  billCount!: number;

  @ApiProperty({ example: 7 })
  paymentCount!: number;

  @ApiProperty({
    type: String,
    example: '2026-03-05T12:00:00.000Z',
    format: 'date-time',
    nullable: true
  })
  latestBillIncurredAt!: string | null;

  @ApiProperty({
    type: String,
    example: '2026-03-05T13:00:00.000Z',
    format: 'date-time',
    nullable: true
  })
  latestPaymentPaidAt!: string | null;
}

export class GroupDashboardContractSummaryDto {
  @ApiProperty({ example: true })
  hasDraft!: boolean;

  @ApiProperty({ type: Number, example: 2, nullable: true })
  publishedVersion!: number | null;

  @ApiProperty({
    type: String,
    example: '2026-03-05T11:00:00.000Z',
    format: 'date-time',
    nullable: true
  })
  updatedAt!: string | null;
}

export class GroupDashboardResponseDto {
  @ApiProperty({ type: () => GroupSummaryDto })
  group!: GroupSummaryDto;

  @ApiProperty({ type: () => GroupDashboardMembersSummaryDto })
  members!: GroupDashboardMembersSummaryDto;

  @ApiProperty({ type: () => GroupDashboardChoresSummaryDto })
  chores!: GroupDashboardChoresSummaryDto;

  @ApiProperty({ type: () => GroupDashboardFinanceSummaryDto })
  finance!: GroupDashboardFinanceSummaryDto;

  @ApiProperty({ type: () => GroupDashboardContractSummaryDto })
  contract!: GroupDashboardContractSummaryDto;
}

export class JoinCodeResetResponseDto {
  @ApiProperty({ example: 'cm8z9ab120001mk8z4og1j0e9' })
  groupId!: string;

  @ApiProperty({ example: 'QWER5678' })
  joinCode!: string;
}

export class GroupMemberSummaryDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ type: String, example: 'Alex Smith', nullable: true })
  displayName!: string | null;

  @ApiProperty({ enum: GroupMemberRole, example: GroupMemberRole.ADMIN })
  role!: GroupMemberRole;

  @ApiProperty({ enum: GroupMemberStatus, example: GroupMemberStatus.ACTIVE })
  status!: GroupMemberStatus;

  @ApiProperty({ example: '2026-03-05T14:40:00.000Z', format: 'date-time' })
  joinedAt!: string;

  @ApiProperty({ example: '2026-03-05T14:40:00.000Z', format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ example: '2026-03-05T14:40:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class GroupMembersResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ type: () => [GroupMemberSummaryDto] })
  members!: GroupMemberSummaryDto[];

  @ApiProperty({ type: () => PaginationMetaDto })
  pagination!: PaginationMetaDto;
}

export class GroupMemberRoleUpdateResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ enum: GroupMemberRole, example: GroupMemberRole.ADMIN })
  role!: GroupMemberRole;

  @ApiProperty({ enum: GroupMemberStatus, example: GroupMemberStatus.ACTIVE })
  status!: GroupMemberStatus;

  @ApiProperty({ example: '2026-03-05T16:44:00.000Z', format: 'date-time' })
  updatedAt!: string;
}

export class GroupMemberRemoveResponseDto {
  @ApiProperty({ example: 'cm8w9z0abc123def456ghi789' })
  groupId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  userId!: string;

  @ApiProperty({ enum: GroupMemberStatus, example: GroupMemberStatus.INACTIVE })
  status!: GroupMemberStatus;

  @ApiProperty({ example: true })
  removed!: boolean;

  @ApiProperty({ example: '2026-03-05T16:44:00.000Z', format: 'date-time' })
  updatedAt!: string;
}
