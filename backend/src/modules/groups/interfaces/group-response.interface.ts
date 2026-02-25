import type { GroupMemberRole, GroupMemberStatus } from '@prisma/client';

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

export interface JoinCodeResetResponse {
  groupId: string;
  joinCode: string;
}

export interface GroupMemberSummary {
  userId: string;
  role: GroupMemberRole;
  status: GroupMemberStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMembersResponse {
  groupId: string;
  members: GroupMemberSummary[];
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
