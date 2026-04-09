import type { ChoreStatus } from '@prisma/client';

import type { PaginationMeta } from '../../../common/http/pagination';

export interface ChoreSummary {
  id: string;
  groupId: string;
  templateId?: string | null;
  title: string;
  description?: string | null;
  status: ChoreStatus;
  dueOn: string;
  assigneeUserId: string;
  createdBy: string;
  completedByUserId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupChoresResponse {
  groupId: string;
  chores: ChoreSummary[];
  pagination: PaginationMeta;
}

export interface ChoreCalendarOccurrence {
  id: string;
  templateId?: string | null;
  title: string;
  description?: string | null;
  dueOn: string;
  assigneeUserId: string;
  status: ChoreStatus;
  completedAt?: string | null;
  completedByUserId?: string | null;
}

export interface GroupChoreCalendarResponse {
  groupId: string;
  start: string;
  end: string;
  occurrences: ChoreCalendarOccurrence[];
}
