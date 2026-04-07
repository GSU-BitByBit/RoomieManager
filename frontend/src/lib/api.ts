import type { ApiResponse, LoginResponse, MeResponse, RegisterResponse } from '@/types/api';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  requestId: string;
  details?: unknown;

  constructor(code: string, message: string, requestId: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }
}

function getToken(): string | null {
  return localStorage.getItem('access_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  authenticated = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': crypto.randomUUID(),
  };

  if (authenticated) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new ApiError(
      json.error.code,
      json.error.message,
      json.meta.requestId,
      json.error.details,
    );
  }

  return json.data;
}

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return '';
  const sp = new URLSearchParams();
  for (const [k, v] of entries) {
    sp.set(k, String(v));
  }
  return `?${sp.toString()}`;
}

// ── Auth ──

export const auth = {
  register(email: string, password: string, fullName?: string) {
    return request<RegisterResponse>(
      'POST',
      '/auth/register',
      { email, password, fullName },
      false,
    );
  },

  login(email: string, password: string) {
    return request<LoginResponse>('POST', '/auth/login', { email, password }, false);
  },

  me() {
    return request<MeResponse>('GET', '/auth/me');
  },
};

// ── Groups ──

export const groups = {
  list(params: Record<string, unknown> = {}) {
    return request<{
      groups: import('@/types/api').GroupSummary[];
      pagination: import('@/types/api').PaginationMeta;
    }>('GET', `/groups${buildQuery(params)}`);
  },

  get(groupId: string) {
    return request<import('@/types/api').GroupSummary>('GET', `/groups/${groupId}`);
  },

  create(name: string) {
    return request<import('@/types/api').GroupSummary>('POST', '/groups', { name });
  },

  join(joinCode: string) {
    return request<import('@/types/api').GroupSummary>('POST', '/groups/join', { joinCode });
  },

  resetJoinCode(groupId: string) {
    return request<import('@/types/api').JoinCodeResetResponse>(
      'POST',
      `/groups/${groupId}/join-code/reset`,
    );
  },

  leave(groupId: string) {
    return request<import('@/types/api').LeaveGroupResponse>(
      'POST',
      `/groups/${groupId}/leave`,
    );
  },

  destroy(groupId: string) {
    return request<import('@/types/api').DestroyGroupResponse>(
      'DELETE',
      `/groups/${groupId}`,
    );
  },

  dashboard(groupId: string) {
    return request<import('@/types/api').DashboardResponse>(
      'GET',
      `/groups/${groupId}/dashboard`,
    );
  },
};

// ── Members ──

export const members = {
  list(groupId: string, params: Record<string, unknown> = {}) {
    return request<import('@/types/api').MembersListResponse>(
      'GET',
      `/groups/${groupId}/members${buildQuery(params)}`,
    );
  },

  updateRole(groupId: string, userId: string, role: 'ADMIN' | 'MEMBER') {
    return request<import('@/types/api').UpdateMemberRoleResponse>(
      'PATCH',
      `/groups/${groupId}/members/${userId}/role`,
      { role },
    );
  },

  remove(groupId: string, userId: string) {
    return request<import('@/types/api').RemoveMemberResponse>(
      'DELETE',
      `/groups/${groupId}/members/${userId}`,
    );
  },
};

// ── Chores ──

export const chores = {
  list(groupId: string, params: Record<string, unknown> = {}) {
    return request<import('@/types/api').ChoresListResponse>(
      'GET',
      `/groups/${groupId}/chores${buildQuery(params)}`,
    );
  },

  create(groupId: string, dto: import('@/types/api').CreateChoreDto) {
    return request<import('@/types/api').Chore>('POST', `/groups/${groupId}/chores`, dto);
  },

  updateAssignee(occurrenceId: string, assigneeUserId: string) {
    return request<import('@/types/api').Chore>('PATCH', `/chores/${occurrenceId}/assignee`, {
      assigneeUserId,
    });
  },

  complete(occurrenceId: string) {
    return request<import('@/types/api').Chore>('PATCH', `/chores/${occurrenceId}/complete`);
  },

  calendar(groupId: string, start: string, end: string) {
    return request<import('@/types/api').ChoreCalendarResponse>(
      'GET',
      `/groups/${groupId}/chores/calendar${buildQuery({ start, end })}`,
    );
  },
};

export const choreTemplates = {
  list(groupId: string) {
    return request<import('@/types/api').GroupChoreTemplatesResponse>(
      'GET',
      `/groups/${groupId}/chore-templates`,
    );
  },

  create(groupId: string, dto: import('@/types/api').CreateChoreTemplateDto) {
    return request<import('@/types/api').ChoreTemplate>(
      'POST',
      `/groups/${groupId}/chore-templates`,
      dto,
    );
  },

  update(
    groupId: string,
    templateId: string,
    dto: import('@/types/api').UpdateChoreTemplateDto,
  ) {
    return request<import('@/types/api').ChoreTemplate>(
      'PATCH',
      `/groups/${groupId}/chore-templates/${templateId}`,
      dto,
    );
  },

  pause(groupId: string, templateId: string) {
    return request<import('@/types/api').ChoreTemplate>(
      'POST',
      `/groups/${groupId}/chore-templates/${templateId}/pause`,
    );
  },

  resume(groupId: string, templateId: string) {
    return request<import('@/types/api').ChoreTemplate>(
      'POST',
      `/groups/${groupId}/chore-templates/${templateId}/resume`,
    );
  },

  archive(groupId: string, templateId: string) {
    return request<import('@/types/api').ChoreTemplate>(
      'POST',
      `/groups/${groupId}/chore-templates/${templateId}/archive`,
    );
  },
};

// ── Finance ──

export const finance = {
  listBills(groupId: string, params: Record<string, unknown> = {}) {
    return request<import('@/types/api').BillsListResponse>(
      'GET',
      `/groups/${groupId}/bills${buildQuery(params)}`,
    );
  },

  createBill(groupId: string, dto: import('@/types/api').CreateBillDto) {
    return request<import('@/types/api').Bill>('POST', `/groups/${groupId}/bills`, dto);
  },

  createPayment(groupId: string, dto: import('@/types/api').CreatePaymentDto) {
    return request<import('@/types/api').Payment>('POST', `/groups/${groupId}/payments`, dto);
  },

  balances(groupId: string) {
    return request<import('@/types/api').BalancesResponse>(
      'GET',
      `/groups/${groupId}/balances`,
    );
  },
};

// ── Contracts ──

export const contracts = {
  get(groupId: string) {
    return request<import('@/types/api').ContractResponse>(
      'GET',
      `/groups/${groupId}/contract`,
    );
  },

  updateDraft(groupId: string, content: string) {
    return request<import('@/types/api').Contract>(
      'PUT',
      `/groups/${groupId}/contract`,
      { content },
    );
  },

  publish(groupId: string) {
    return request<import('@/types/api').ContractVersion>(
      'POST',
      `/groups/${groupId}/contract/publish`,
    );
  },

  listVersions(groupId: string, params: Record<string, unknown> = {}) {
    return request<import('@/types/api').ContractVersionsResponse>(
      'GET',
      `/groups/${groupId}/contract/versions${buildQuery(params)}`,
    );
  },
};

const api = { auth, groups, members, chores, choreTemplates, finance, contracts };
export default api;
