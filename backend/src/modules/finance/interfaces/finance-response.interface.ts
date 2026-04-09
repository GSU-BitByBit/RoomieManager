import type { PaginationMeta } from '../../../common/http/pagination';

export interface BillSplitSummary {
  id: string;
  userId: string;
  amount: number;
  createdAt: string;
}

export interface BillSummary {
  id: string;
  groupId: string;
  title: string;
  description?: string | null;
  totalAmount: number;
  currency: string;
  paidByUserId: string;
  splitMethod: 'CUSTOM';
  createdBy: string;
  incurredAt: string;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  splits: BillSplitSummary[];
}

export interface GroupBillsResponse {
  groupId: string;
  bills: BillSummary[];
  pagination: PaginationMeta;
}

export interface PaymentSummary {
  id: string;
  groupId: string;
  billId?: string | null;
  payerUserId: string;
  payeeUserId: string;
  amount: number;
  currency: string;
  note?: string | null;
  idempotencyKey?: string | null;
  paidAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SettlementSummary {
  fromUserId: string;
  toUserId: string;
  amount: number;
}

export interface MemberBalanceSummary {
  userId: string;
  netAmount: number;
}

export interface CurrencyBalanceSummary {
  currency: string;
  settlements: SettlementSummary[];
  memberBalances: MemberBalanceSummary[];
}

export interface GroupBalancesResponse {
  groupId: string;
  balances: CurrencyBalanceSummary[];
}
