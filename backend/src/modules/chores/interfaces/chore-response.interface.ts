import type { ChoreStatus } from '@prisma/client';

import type { PaginationMeta } from '../../../common/http/pagination';

export interface ChoreSummary {
  id: string;
  groupId: string;
  title: string;
  description?: string | null;
  status: ChoreStatus;
  dueDate?: string | null;
  assignedToUserId?: string | null;
  createdBy: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupChoresResponse {
  groupId: string;
  chores: ChoreSummary[];
  pagination: PaginationMeta;
}
