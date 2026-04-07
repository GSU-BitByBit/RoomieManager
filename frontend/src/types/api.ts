import type { components } from "../../generated/backend-api.types";

// API response types matching backend response contract

type BackendSchemas = components["schemas"];

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
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

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
  email: string;
  role: string;
  aud: string;
}

// Groups
export interface GroupSummary {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  memberRole: "ADMIN" | "MEMBER";
  memberStatus: string;
  memberCount: number;
  joinCode?: string;
}

export interface GroupsListResponse {
  groups: GroupSummary[];
  pagination: PaginationMeta;
}

export interface JoinCodeResetResponse {
  groupId: string;
  joinCode: string;
}

// Members
export interface GroupMember {
  userId: string;
  displayName: string | null;
  role: "ADMIN" | "MEMBER";
  status: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MembersListResponse {
  groupId: string;
  members: GroupMember[];
  pagination: PaginationMeta;
}

export interface UpdateMemberRoleResponse {
  groupId: string;
  userId: string;
  role: "ADMIN" | "MEMBER";
  status: string;
  updatedAt: string;
}

export interface RemoveMemberResponse {
  groupId: string;
  userId: string;
  status: string;
  removed: boolean;
  updatedAt: string;
}

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
export interface BillSplit {
  id: string;
  userId: string;
  amount: string;
}

export interface Bill {
  id: string;
  groupId: string;
  title: string;
  description: string | null;
  totalAmount: string;
  currency: string;
  paidByUserId: string;
  splitMethod: "EQUAL" | "CUSTOM";
  createdBy: string;
  incurredAt: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  splits: BillSplit[];
}

export interface BillsListResponse {
  groupId: string;
  bills: Bill[];
  pagination: PaginationMeta;
}

export interface Payment {
  id: string;
  groupId: string;
  billId: string | null;
  payerUserId: string;
  payeeUserId: string;
  amount: string;
  currency: string;
  note: string | null;
  paidAt: string;
  createdBy: string;
  createdAt: string;
}

export interface MemberBalance {
  userId: string;
  netAmount: number;
}

export interface Settlement {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface CurrencyBalanceSummary {
  currency: string;
  memberBalances: MemberBalance[];
  settlements: Settlement[];
}

export interface BalancesResponse {
  groupId: string;
  balances: CurrencyBalanceSummary[];
}

// Contracts
export interface Contract {
  id: string;
  groupId: string;
  draftContent: string;
  publishedVersion: number | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractResponse {
  contract: Contract;
  latestPublishedContent: string | null;
}

export interface ContractVersion {
  id: string;
  version: number;
  content: string;
  publishedBy: string;
  createdAt: string;
}

export interface ContractVersionsResponse {
  groupId: string;
  versions: ContractVersion[];
  pagination: PaginationMeta;
}

export interface CreateBillDto {
  title: string;
  description?: string;
  totalAmount: number;
  currency?: string;
  paidByUserId: string;
  splits: { userId: string; amount: number }[];
  incurredAt?: string;
  dueDate?: string;
}

export interface CreatePaymentDto {
  payerUserId: string;
  payeeUserId: string;
  amount: number;
  currency: string;
  note?: string;
  paidAt: string;
  billId?: string;
  idempotencyKey?: string;
}

export type CreateChoreDto = BackendSchemas["CreateChoreDto"];

export type CreateChoreTemplateDto = BackendSchemas["CreateChoreTemplateDto"];

export type UpdateChoreTemplateDto = BackendSchemas["UpdateChoreTemplateDto"];
