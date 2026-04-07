import type { ChoreTemplateAssignmentStrategy, ChoreTemplateStatus } from '@prisma/client';

export interface ChoreTemplateParticipantSummary {
  userId: string;
  sortOrder: number;
}

export interface ChoreTemplateSummary {
  id: string;
  groupId: string;
  title: string;
  description?: string | null;
  status: ChoreTemplateStatus;
  assignmentStrategy: ChoreTemplateAssignmentStrategy;
  startsOn: string;
  endsOn?: string | null;
  repeatEveryDays: number;
  assigneeUserId?: string | null;
  participants: ChoreTemplateParticipantSummary[];
  createdBy: string;
  updatedBy?: string | null;
  generatedThroughOn?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupChoreTemplatesResponse {
  groupId: string;
  templates: ChoreTemplateSummary[];
}
