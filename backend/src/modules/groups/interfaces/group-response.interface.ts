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
