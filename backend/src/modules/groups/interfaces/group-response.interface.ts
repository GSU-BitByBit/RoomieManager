import type { GroupMemberRole, GroupMemberStatus } from '@prisma/client';

import type { PaginationMeta } from '../../../common/http/pagination';

export interface GroupSummary {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberRole: GroupMemberRole;
  memberStatus: GroupMemberStatus;
  memberCount: number;
  joinCode?: string;
}

export interface UserGroupsResponse {
  groups: GroupSummary[];
  pagination: PaginationMeta;
}

export interface GroupDashboardMembersSummary {
  totalActive: number;
  adminCount: number;
  memberCount: number;
}

export interface GroupDashboardChoresSummary {
  overdueCount: number;
  dueTodayCount: number;
  dueNext7DaysCount: number;
  assignedToMeDueNext7DaysCount: number;
}

export interface GroupDashboardFinanceSummary {
  billCount: number;
  paymentCount: number;
  latestBillIncurredAt: string | null;
  latestPaymentPaidAt: string | null;
}

export interface GroupDashboardContractSummary {
  hasDraft: boolean;
  publishedVersion: number | null;
  updatedAt: string | null;
}

export interface GroupDashboardResponse {
  group: GroupSummary;
  members: GroupDashboardMembersSummary;
  chores: GroupDashboardChoresSummary;
  finance: GroupDashboardFinanceSummary;
  contract: GroupDashboardContractSummary;
}

export interface JoinCodeResetResponse {
  groupId: string;
  joinCode: string;
}

export interface GroupMemberSummary {
  userId: string;
  displayName: string | null;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMembersResponse {
  groupId: string;
  members: GroupMemberSummary[];
  pagination: PaginationMeta;
}

export interface GroupMemberRoleUpdateResponse {
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  updatedAt: string;
}

export interface GroupMemberRemoveResponse {
  groupId: string;
  userId: string;
  status: GroupMemberStatus;
  removed: boolean;
  updatedAt: string;
}

export interface GroupMemberLeaveResponse {
  groupId: string;
  userId: string;
  status: GroupMemberStatus;
  left: boolean;
  updatedAt: string;
}

export interface GroupDestroyResponse {
  groupId: string;
  destroyed: boolean;
}
