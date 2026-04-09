import type { components } from '../../generated/backend-api.types';

// API response types matching backend response contract

type BackendSchemas = components['schemas'];

export interface ApiMeta {
  requestId: string;
  timestamp: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta: ApiMeta;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

// Pagination
export type PaginationMeta = BackendSchemas['PaginationMetaDto'];

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Auth
export interface AuthUser {
  id: string;
  email: string;
  emailConfirmedAt?: string | null;
  phone?: string | null;
  createdAt?: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginResponse {
  user: AuthUser;
  session: AuthSession;
}

export interface RegisterResponse {
  user: AuthUser;
  session: AuthSession | null;
}

export interface MeResponse {
  id: string;
  email?: string;
  role?: string;
  aud?: string;
  appMetadata?: Record<string, unknown>;
  userMetadata?: Record<string, unknown>;
}

// Groups
export type GroupSummary = BackendSchemas['GroupSummaryDto'];

export type GroupsListResponse = BackendSchemas['UserGroupsResponseDto'];

export type JoinCodeResetResponse = BackendSchemas['JoinCodeResetResponseDto'];

// Members
export type GroupMember = BackendSchemas['GroupMemberSummaryDto'];

export type MembersListResponse = BackendSchemas['GroupMembersResponseDto'];

export type UpdateMemberRoleResponse =
  BackendSchemas['GroupMemberRoleUpdateResponseDto'];

export type RemoveMemberResponse =
  BackendSchemas['GroupMemberRemoveResponseDto'];

export type LeaveGroupResponse =
  BackendSchemas['GroupMemberLeaveResponseDto'];

export type DestroyGroupResponse =
  BackendSchemas['GroupDestroyResponseDto'];

// Dashboard
export type DashboardResponse = BackendSchemas["GroupDashboardResponseDto"];

// Chores
export type Chore = BackendSchemas["ChoreSummaryDto"];

export type ChoresListResponse = BackendSchemas["GroupChoresResponseDto"];

export interface ChoresQuery extends PaginationQuery {
  status?: BackendSchemas["ChoreStatus"];
  assigneeUserId?: string;
  dueOnFrom?: string;
  dueOnTo?: string;
}

export type ChoreCalendarOccurrence =
  BackendSchemas["ChoreCalendarOccurrenceDto"];

export type ChoreCalendarResponse =
  BackendSchemas["GroupChoreCalendarResponseDto"];

export type ChoreTemplate = BackendSchemas["ChoreTemplateSummaryDto"];

export type GroupChoreTemplatesResponse =
  BackendSchemas["GroupChoreTemplatesResponseDto"];

export type ChoreTemplateAssignmentStrategy =
  BackendSchemas["ChoreTemplateAssignmentStrategy"];

export type ChoreTemplateParticipant =
  BackendSchemas["ChoreTemplateParticipantSummaryDto"];

// Finance
export type BillSplit = BackendSchemas["BillSplitSummaryDto"];

export type Bill = BackendSchemas["BillSummaryDto"];

export type BillsListResponse = BackendSchemas["GroupBillsResponseDto"];

export type Payment = BackendSchemas["PaymentSummaryDto"];

export type MemberBalance = BackendSchemas["MemberBalanceSummaryDto"];

export type Settlement = BackendSchemas["SettlementSummaryDto"];

export type CurrencyBalanceSummary =
  BackendSchemas["CurrencyBalanceSummaryDto"];

export type BalancesResponse = BackendSchemas["GroupBalancesResponseDto"];

// Contracts
export type Contract = BackendSchemas['ContractSummaryDto'];

export type ContractResponse = BackendSchemas['ContractDetailResponseDto'];

export type ContractVersion = BackendSchemas['ContractVersionSummaryDto'];

export type ContractVersionsResponse =
  BackendSchemas['ContractVersionsResponseDto'];

export type CreateBillDto = BackendSchemas["CreateBillDto"];

export type CreatePaymentDto = BackendSchemas["CreatePaymentDto"];

export type CreateChoreDto = BackendSchemas["CreateChoreDto"];

export type CreateChoreTemplateDto = BackendSchemas["CreateChoreTemplateDto"];

export type UpdateChoreTemplateDto = BackendSchemas["UpdateChoreTemplateDto"];
