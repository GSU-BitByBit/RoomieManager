import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { finance as financeApi, members as membersApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { resolveIdentityLabel } from '@/lib/identity';
import type {
  Bill,
  BillsListResponse,
  BalancesResponse,
  GroupMember,
  CreateBillDto,
  CreatePaymentDto,
} from '@/types/api';
import {
  Plus,
  DollarSign,
  ArrowRightLeft,
  Receipt,
  TrendingUp,
  TrendingDown,
  X,
  Wallet,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

type Tab = 'bills' | 'balances';
type DraftBillSplitRow = {
  userId: string;
  included: boolean;
  amount: string;
};

const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] as const;

function parseAmountInputToCents(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

function centsToAmountString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function distributeEvenly(totalCents: number, memberCount: number): number[] {
  if (memberCount <= 0) return [];

  const base = Math.floor(totalCents / memberCount);
  const remainder = totalCents % memberCount;

  return Array.from({ length: memberCount }, (_, index) =>
    base + (index < remainder ? 1 : 0),
  );
}

function toDateInputValue(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function dateInputToIso(dateValue: string): string | undefined {
  const trimmed = dateValue.trim();
  if (!trimmed) return undefined;

  const [year, month, day] = trimmed.split('-').map(Number);
  if (!year || !month || !day) return undefined;

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).toISOString();
}

function getMemberOptionLabel(
  members: GroupMember[],
  userId: string,
  currentUserId: string,
): string {
  if (userId === currentUserId) return 'You';
  const member = members.find((candidate) => candidate.userId === userId);
  return resolveIdentityLabel({
    displayName: member?.displayName,
    userId,
    fallbackLabel: 'Unknown member',
  });
}

export default function FinancePage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('bills');
  const [bills, setBills] = useState<BillsListResponse | null>(null);
  const [balances, setBalances] = useState<BalancesResponse | null>(null);
  const [membersList, setMembersList] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [showCreatePayment, setShowCreatePayment] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await membersApi.list(groupId, { pageSize: 100 });
      setMembersList(data.members);
    } catch {
      // silent — members used for display only
    }
  }, [groupId]);

  const fetchBills = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await financeApi.listBills(groupId, { pageSize: 50 });
      setBills(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }, [groupId]);

  const fetchBalances = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await financeApi.balances(groupId);
      setBalances(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  }, [groupId]);

  useEffect(() => {
    Promise.all([fetchBills(), fetchBalances(), fetchMembers()]).finally(() =>
      setLoading(false),
    );
  }, [fetchBills, fetchBalances, fetchMembers]);

  const getUserLabel = (userId: string) => {
    if (userId === user?.id) return 'You';
    const member = membersList.find((m) => m.userId === userId);
    return resolveIdentityLabel({
      displayName: member?.displayName,
      userId,
      fallbackLabel: 'Unknown member',
    });
  };
  const currentUserIsAdmin =
    membersList.find((member) => member.userId === user?.id)?.role === 'ADMIN';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Finance</h1>
          <p className="page-subtitle">Bills, payments, and balances</p>
        </div>
        <div className="flex gap-2.5">
          <button onClick={() => setShowCreatePayment(true)} className="btn-secondary">
            <ArrowRightLeft size={16} />
            Record Payment
          </button>
          <button onClick={() => setShowCreateBill(true)} className="btn-primary">
            <Plus size={16} />
            New Bill
          </button>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="flex w-fit gap-1 rounded-2xl border border-sage-100/40 bg-white/50 p-1.5 backdrop-blur-sm">
        <button
          onClick={() => setTab('bills')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
            tab === 'bills'
              ? 'bg-white text-charcoal shadow-sm'
              : 'text-slate-400 hover:text-charcoal'
          }`}
        >
          <Receipt size={16} />
          Bills
        </button>
        <button
          onClick={() => setTab('balances')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
            tab === 'balances'
              ? 'bg-white text-charcoal shadow-sm'
              : 'text-slate-400 hover:text-charcoal'
          }`}
        >
          <Wallet size={16} />
          Balances
        </button>
      </div>

      {tab === 'bills' && (
        <BillsList bills={bills?.bills ?? []} getUserLabel={getUserLabel} />
      )}

      {tab === 'balances' && balances && (
        <BalancesView balances={balances} getUserLabel={getUserLabel} currentUserId={user!.id} />
      )}

      {/* Create Bill Modal */}
      {showCreateBill && groupId && (
        <CreateBillModal
          groupId={groupId}
          members={membersList}
          currentUserId={user!.id}
          onClose={() => {
            setShowCreateBill(false);
            fetchBills();
            fetchBalances();
          }}
        />
      )}

      {/* Create Payment Modal */}
      {showCreatePayment && groupId && (
        <CreatePaymentModal
          groupId={groupId}
          bills={bills?.bills ?? []}
          members={membersList}
          currentUserId={user!.id}
          isCurrentUserAdmin={currentUserIsAdmin}
          onClose={() => {
            setShowCreatePayment(false);
            fetchBills();
            fetchBalances();
          }}
        />
      )}
    </div>
  );
}

function BillsList({
  bills,
  getUserLabel,
}: {
  bills: Bill[];
  getUserLabel: (id: string) => string;
}) {
  if (bills.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50">
          <Receipt className="h-6 w-6 text-sage-300" />
        </div>
        <h3 className="font-display text-xl text-charcoal">No bills yet</h3>
        <p className="mt-2 text-sm text-slate-500">Create a bill to start tracking expenses</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {bills.map((bill) => (
        <div key={bill.id} className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-charcoal">{bill.title}</h3>
              {bill.description && (
                <p className="mt-0.5 text-sm text-slate-500">{bill.description}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span>Paid by {getUserLabel(bill.paidByUserId)}</span>
                <span>{format(parseISO(bill.incurredAt), 'MMM d, yyyy')}</span>
                <span>{bill.splits.length} split{bill.splits.length !== 1 ? 's' : ''}</span>
                {bill.dueDate && (
                  <span>Due {format(parseISO(bill.dueDate), 'MMM d, yyyy')}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-charcoal">
                {bill.currency} {bill.totalAmount.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function BalancesView({
  balances,
  getUserLabel,
  currentUserId,
}: {
  balances: BalancesResponse;
  getUserLabel: (id: string) => string;
  currentUserId: string;
}) {
  if (balances.balances.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-dusty-50">
          <Wallet className="h-6 w-6 text-dusty-300" />
        </div>
        <h3 className="font-display text-xl text-charcoal">No balances yet</h3>
        <p className="mt-2 text-sm text-slate-500">Create a bill to start tracking balances</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {balances.balances.map((cb) => (
        <div key={cb.currency} className="space-y-4">
          {(() => {
            const currentUserBalance =
              cb.memberBalances.find((memberBalance) => memberBalance.userId === currentUserId)
                ?.netAmount ?? 0;
            const creditors = cb.memberBalances.filter((memberBalance) => memberBalance.netAmount > 0);
            const debtors = cb.memberBalances.filter((memberBalance) => memberBalance.netAmount < 0);
            const settledMembers = cb.memberBalances.filter(
              (memberBalance) => memberBalance.netAmount === 0,
            );
            const orderedBalances = [...cb.memberBalances].sort((a, b) => {
              if (a.userId === currentUserId) return -1;
              if (b.userId === currentUserId) return 1;
              if (a.netAmount === 0 && b.netAmount !== 0) return 1;
              if (b.netAmount === 0 && a.netAmount !== 0) return -1;
              return Math.abs(b.netAmount) - Math.abs(a.netAmount);
            });

            return (
              <div className="card space-y-5 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {cb.currency} Balances
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Balances reflect the shared group ledger for this currency only.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sage-100/40 bg-sage-50/70 px-4 py-3 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Your Position
                    </p>
                    <p
                      className={`mt-1 text-lg font-semibold ${
                        currentUserBalance > 0
                          ? 'text-sage-600'
                          : currentUserBalance < 0
                            ? 'text-blush-600'
                            : 'text-slate-500'
                      }`}
                    >
                      {currentUserBalance > 0
                        ? "You're owed"
                        : currentUserBalance < 0
                          ? 'You owe'
                          : "You're settled"}
                    </p>
                    <p className="mt-1 text-sm text-charcoal">
                      {cb.currency} {Math.abs(currentUserBalance).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Members Owed
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-sage-600">
                      {creditors.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Positive balances that should receive money.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Members Owing
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-blush-600">
                      {debtors.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Negative balances that still need repayment.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Suggested Transfers
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-charcoal">
                      {cb.settlements.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Advisory transfer suggestions for this currency.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Settled Members
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-500">
                      {settledMembers.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Members currently at a zero net position.
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Member Positions
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {orderedBalances.map((mb) => {
                      const net = mb.netAmount;
                      const isPositive = net > 0;
                      const isZero = net === 0;
                      const statusLabel = isPositive
                        ? 'Is owed'
                        : isZero
                          ? 'Settled'
                          : 'Owes money';

                      return (
                        <div key={mb.userId} className="rounded-2xl border border-sage-100/40 bg-white/80 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                {isPositive ? (
                                  <TrendingUp size={16} className="text-sage-500" />
                                ) : isZero ? (
                                  <DollarSign size={16} className="text-slate-400" />
                                ) : (
                                  <TrendingDown size={16} className="text-blush-500" />
                                )}
                                <span className="font-medium text-charcoal">
                                  {getUserLabel(mb.userId)}
                                </span>
                                {mb.userId === currentUserId && <span className="badge-blue">You</span>}
                              </div>
                              <p className="mt-2 text-xs text-slate-500">{statusLabel}</p>
                            </div>
                            <span
                              className={`font-bold ${
                                isPositive
                                  ? 'text-sage-600'
                                  : isZero
                                    ? 'text-slate-500'
                                    : 'text-blush-600'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {cb.currency} {net.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Suggested Settlements
                  </h4>
                  <p className="mb-3 text-xs text-slate-500">
                    Advisory only. Record a payment after it happens outside the app.
                  </p>
                  {cb.settlements.length > 0 ? (
                    <div className="space-y-2">
                      {cb.settlements.map((s, i) => (
                        <div
                          key={i}
                          className="rounded-2xl border border-sage-100/40 bg-white/80 p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-charcoal">{getUserLabel(s.fromUserId)}</span>
                              <ArrowRightLeft size={14} className="text-slate-400" />
                              <span className="font-medium text-charcoal">{getUserLabel(s.toUserId)}</span>
                              {(s.fromUserId === currentUserId || s.toUserId === currentUserId) && (
                                <span className="badge-blue">Includes You</span>
                              )}
                            </div>
                            <span className="font-bold text-charcoal">
                              {cb.currency} {s.amount.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-sage-100/40 bg-sage-50/60 px-4 py-3 text-sm text-slate-500">
                      No settlement suggestions right now. This currency is currently balanced enough
                      that there is nothing actionable to record.
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

function CreateBillModal({
  groupId,
  members,
  currentUserId,
  onClose,
}: {
  groupId: string;
  members: GroupMember[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [incurredOn, setIncurredOn] = useState(() => toDateInputValue(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [splitRows, setSplitRows] = useState<DraftBillSplitRow[]>(() =>
    members.map((member) => ({
      userId: member.userId,
      included: true,
      amount: '',
    })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const selectedSplitRows = splitRows.filter((row) => row.included);
  const totalAmountCents = parseAmountInputToCents(totalAmount);
  const assignedTotalCents = selectedSplitRows.reduce((sum, row) => {
    const amountCents = parseAmountInputToCents(row.amount);
    return sum + (amountCents ?? 0);
  }, 0);
  const splitDifferenceCents =
    totalAmountCents === null ? null : totalAmountCents - assignedTotalCents;
  const hasInvalidSplitAmount = selectedSplitRows.some((row) => {
    const trimmedAmount = row.amount.trim();
    return trimmedAmount.length > 0 && parseAmountInputToCents(trimmedAmount) === null;
  });
  const hasNonPositiveSelectedSplit = selectedSplitRows.some((row) => {
    const amountCents = parseAmountInputToCents(row.amount);
    return amountCents === null || amountCents <= 0;
  });
  const isSplitValid =
    totalAmountCents !== null &&
    totalAmountCents > 0 &&
    selectedSplitRows.length > 0 &&
    !hasInvalidSplitAmount &&
    !hasNonPositiveSelectedSplit &&
    splitDifferenceCents === 0;

  const updateSplitRow = (
    userId: string,
    updater: (row: DraftBillSplitRow) => DraftBillSplitRow,
  ) => {
    setSplitRows((currentRows) =>
      currentRows.map((row) => (row.userId === userId ? updater(row) : row)),
    );
  };

  const applyEqualSplit = () => {
    if (totalAmountCents === null || totalAmountCents <= 0 || members.length === 0) {
      return;
    }

    const shares = distributeEvenly(totalAmountCents, members.length);
    setLocalError('');

    setSplitRows((currentRows) =>
      currentRows.map((row, index) => {
        const nextAmount = shares[index] ?? 0;
        return {
          ...row,
          included: true,
          amount: centsToAmountString(nextAmount),
        };
      }),
    );
  };

  const includeEveryone = () => {
    setSplitRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        included: true,
      })),
    );
  };

  const clearSplitAmounts = () => {
    setSplitRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        amount: '',
      })),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (members.length === 0) {
      setLocalError('Member list is unavailable. Refresh the page and try again.');
      return;
    }

    if (totalAmountCents === null || totalAmountCents <= 0) {
      setLocalError('Enter a valid amount');
      return;
    }

    if (selectedSplitRows.length === 0) {
      setLocalError('Include at least one member in the split.');
      return;
    }

    if (hasInvalidSplitAmount || hasNonPositiveSelectedSplit) {
      setLocalError('Each included member needs a positive split amount.');
      return;
    }

    if (splitDifferenceCents !== 0) {
      setLocalError('Split amounts must match the bill total exactly.');
      return;
    }

    const dto: CreateBillDto = {
      title: title.trim(),
      description: description.trim() || undefined,
      totalAmount: totalAmountCents / 100,
      currency,
      paidByUserId,
      splits: selectedSplitRows.map((row) => ({
        userId: row.userId,
        amount: (parseAmountInputToCents(row.amount) ?? 0) / 100,
      })),
      incurredAt: dateInputToIso(incurredOn),
      dueDate: dateInputToIso(dueDate),
    };

    setSubmitting(true);
    try {
      await financeApi.createBill(groupId, dto);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setLocalError(err.message);
      else setLocalError('Failed to create bill');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-h-[90vh] max-w-5xl overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-charcoal">Create Bill</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
          >
            <X size={20} />
          </button>
        </div>

        {localError && <div className="mb-4 alert-error">{localError}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="space-y-4">
              <div className="rounded-[28px] border border-sage-100/40 bg-white/85 p-5 sm:p-6">
                <div className="mb-5 space-y-1">
                  <h3 className="text-sm font-semibold text-charcoal">Bill Details</h3>
                  <p className="text-sm text-slate-500">
                    Capture the expense, who covered it, and when it happened.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="create-bill-title" className="label">
                      Title
                    </label>
                    <input
                      id="create-bill-title"
                      className="input"
                      placeholder="e.g. Grocery shopping"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                      maxLength={160}
                    />
                  </div>

                  <div>
                    <label htmlFor="create-bill-description" className="label">
                      Description
                    </label>
                    <input
                      id="create-bill-description"
                      className="input"
                      placeholder="Additional notes (optional)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
                    <div>
                      <label htmlFor="create-bill-amount" className="label">
                        Amount
                      </label>
                      <input
                        id="create-bill-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input"
                        placeholder="0.00"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="create-bill-currency" className="label">
                        Currency
                      </label>
                      <select
                        id="create-bill-currency"
                        className="input"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        {CURRENCY_OPTIONS.map((currencyOption) => (
                          <option key={currencyOption} value={currencyOption}>
                            {currencyOption}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="create-bill-paid-by" className="label">
                      Paid By
                    </label>
                    <select
                      id="create-bill-paid-by"
                      className="input"
                      value={paidByUserId}
                      onChange={(e) => setPaidByUserId(e.target.value)}
                    >
                      {members.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {getMemberOptionLabel(members, member.userId, currentUserId)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="create-bill-incurred-on" className="label">
                        Incurred On
                      </label>
                      <input
                        id="create-bill-incurred-on"
                        type="date"
                        className="input"
                        value={incurredOn}
                        onChange={(e) => setIncurredOn(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="create-bill-due-date" className="label">
                        Due Date
                      </label>
                      <input
                        id="create-bill-due-date"
                        type="date"
                        className="input"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Optional. Informational only for now.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-sage-100/40 bg-sage-50/65 p-5 sm:p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-charcoal">Split Members</h3>
                        <span className="badge-gray">{selectedSplitRows.length} included</span>
                      </div>
                      <p className="text-sm text-slate-500">
                        Choose who shares the bill and set each amount explicitly.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={includeEveryone}
                        disabled={members.length === 0}
                      >
                        Include Everyone
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={applyEqualSplit}
                        disabled={
                          totalAmountCents === null ||
                          totalAmountCents <= 0 ||
                          members.length === 0
                        }
                      >
                        Split Equally
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={clearSplitAmounts}
                        disabled={splitRows.every((row) => row.amount === '')}
                      >
                        Clear Amounts
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/80 bg-white/85 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Bill Total
                      </p>
                      <p className="mt-1 text-lg font-semibold text-charcoal">
                        {currency}{' '}
                        {totalAmountCents === null ? '0.00' : centsToAmountString(totalAmountCents)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/85 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Assigned
                      </p>
                      <p className="mt-1 text-lg font-semibold text-charcoal">
                        {currency} {centsToAmountString(assignedTotalCents)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/80 bg-white/85 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Difference
                      </p>
                      <p
                        className={`mt-1 text-lg font-semibold ${
                          splitDifferenceCents === 0
                            ? 'text-sage-600'
                            : (splitDifferenceCents ?? 0) > 0
                              ? 'text-dusty-600'
                              : 'text-blush-600'
                        }`}
                      >
                        {currency}{' '}
                        {splitDifferenceCents === null
                          ? '0.00'
                          : centsToAmountString(Math.abs(splitDifferenceCents))}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {splitDifferenceCents === null || splitDifferenceCents === 0
                          ? 'Ready to submit'
                          : splitDifferenceCents > 0
                            ? 'Still unassigned'
                            : 'Over the total'}
                      </p>
                    </div>
                  </div>

                  {members.length === 0 ? (
                    <div className="rounded-2xl border border-blush-200 bg-blush-50 px-4 py-3 text-sm text-blush-700">
                      Member list unavailable. Refresh the page before creating a bill.
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-white/80 bg-white/85 p-4 sm:p-5">
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-charcoal">Member Shares</h4>
                          <p className="text-xs text-slate-500">
                            Final included shares must add up to the full bill.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 xl:max-h-[52vh] xl:overflow-y-auto xl:pr-1">
                        {members.map((member) => {
                          const row = splitRows.find((splitRow) => splitRow.userId === member.userId);
                          const amountCents = row ? parseAmountInputToCents(row.amount) : null;
                          const showRowError =
                            row?.included &&
                            row.amount.trim().length > 0 &&
                            (amountCents === null || amountCents < 0);
                          const shareAmountInputId = `create-bill-share-amount-${member.userId}`;

                          return (
                            <div
                              key={member.userId}
                              className={`rounded-2xl border p-4 transition-colors ${
                                row?.included
                                  ? 'border-sage-200 bg-white'
                                  : 'border-sage-100/60 bg-sage-50/40'
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                  <p className="font-medium text-charcoal">
                                    {getMemberOptionLabel(members, member.userId, currentUserId)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {member.userId === paidByUserId
                                      ? 'Currently marked as the payer.'
                                      : 'Include this member only if they owe part of the bill.'}
                                  </p>
                                </div>
                                <label className="flex items-center gap-2 text-sm font-medium text-charcoal">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-sage-200 text-sage-600 focus:ring-sage-300"
                                    checked={row?.included ?? false}
                                    onChange={(e) =>
                                      updateSplitRow(member.userId, (currentRow) => ({
                                        ...currentRow,
                                        included: e.target.checked,
                                        amount: e.target.checked ? currentRow.amount : '',
                                      }))
                                    }
                                  />
                                  Include
                                </label>
                              </div>

                              {row?.included && (
                                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_110px] sm:items-end">
                                  <div>
                                    <label htmlFor={shareAmountInputId} className="label">
                                      Share Amount
                                    </label>
                                    <input
                                      id={shareAmountInputId}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      className="input"
                                      placeholder="0.00"
                                      value={row.amount}
                                      onChange={(e) =>
                                        updateSplitRow(member.userId, (currentRow) => ({
                                          ...currentRow,
                                          amount: e.target.value,
                                        }))
                                      }
                                    />
                                    <p
                                      className={`mt-1 text-xs ${
                                        showRowError ? 'text-blush-600' : 'text-slate-500'
                                      }`}
                                    >
                                      {showRowError
                                        ? 'Enter a valid amount with up to 2 decimals.'
                                        : 'Final share must be greater than zero.'}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl border border-sage-100/60 bg-sage-50/50 px-3 py-2 text-right">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                      Current
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-charcoal">
                                      {currency}{' '}
                                      {amountCents === null ? '0.00' : centsToAmountString(amountCents)}
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-sage-100/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Use the equal split helper as a shortcut, then adjust member shares if needed.
            </p>
            <div className="flex gap-2 sm:justify-end">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || members.length === 0 || !isSplitValid}
              >
                {submitting ? 'Creating...' : 'Create Bill'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePaymentModal({
  groupId,
  bills,
  members,
  currentUserId,
  isCurrentUserAdmin,
  onClose,
}: {
  groupId: string;
  bills: Bill[];
  members: GroupMember[];
  currentUserId: string;
  isCurrentUserAdmin: boolean;
  onClose: () => void;
}) {
  const [payerUserId, setPayerUserId] = useState(currentUserId);
  const [payeeUserId, setPayeeUserId] = useState(
    members.find((m) => m.userId !== currentUserId)?.userId ?? '',
  );
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [paidOn, setPaidOn] = useState(() => toDateInputValue(new Date()));
  const [relatedBillId, setRelatedBillId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const payeeOptions = members.filter((member) => member.userId !== payerUserId);
  const referenceableBills = bills.filter((bill) => bill.currency === currency);

  useEffect(() => {
    if (!isCurrentUserAdmin && payerUserId !== currentUserId) {
      setPayerUserId(currentUserId);
    }
  }, [currentUserId, isCurrentUserAdmin, payerUserId]);

  useEffect(() => {
    if (payeeOptions.length === 0) {
      if (payeeUserId !== '') {
        setPayeeUserId('');
      }
      return;
    }

    if (!payeeOptions.some((member) => member.userId === payeeUserId)) {
      setPayeeUserId(payeeOptions[0]?.userId ?? '');
    }
  }, [payeeOptions, payeeUserId]);

  useEffect(() => {
    if (relatedBillId && !referenceableBills.some((bill) => bill.id === relatedBillId)) {
      setRelatedBillId('');
    }
  }, [currency, referenceableBills, relatedBillId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (members.length === 0) {
      setLocalError('Member list is unavailable. Refresh the page and try again.');
      return;
    }

    const parsedAmountCents = parseAmountInputToCents(amount);
    if (parsedAmountCents === null || parsedAmountCents <= 0) {
      setLocalError('Enter a valid amount');
      return;
    }

    if (!payeeUserId) {
      setLocalError('Choose who is receiving the payment.');
      return;
    }

    if (payerUserId === payeeUserId) {
      setLocalError('Payer and payee must be different');
      return;
    }

    const dto: CreatePaymentDto = {
      payerUserId,
      payeeUserId,
      amount: parsedAmountCents / 100,
      currency,
      note: note.trim() || undefined,
      billId: relatedBillId || undefined,
      paidAt: dateInputToIso(paidOn),
    };

    setSubmitting(true);
    try {
      await financeApi.createPayment(groupId, dto);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) setLocalError(err.message);
      else setLocalError('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-lg">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl text-charcoal">Record Payment</h2>
            <p className="mt-1 text-sm text-slate-500">
              Log a payment that already happened outside the app.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
          >
            <X size={20} />
          </button>
        </div>

        {localError && <div className="mb-4 alert-error">{localError}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-sage-100/40 bg-sage-50/60 p-4 text-sm text-slate-600">
            Payments are recorded here for bookkeeping only. RoomieManager does not send money or
            track exact per-bill payoff state.
          </div>

          <div>
            <label htmlFor="create-payment-payer" className="label">
              From (Payer)
            </label>
            <select
              id="create-payment-payer"
              className="input"
              value={payerUserId}
              onChange={(e) => setPayerUserId(e.target.value)}
              disabled={!isCurrentUserAdmin}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {getMemberOptionLabel(members, m.userId, currentUserId)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {isCurrentUserAdmin
                ? 'Admins can record a payment on behalf of the payer when reconciling the group ledger.'
                : 'Only the payer or a group admin can record a payment.'}
            </p>
          </div>

          <div>
            <label htmlFor="create-payment-payee" className="label">
              To (Payee)
            </label>
            <select
              id="create-payment-payee"
              className="input"
              value={payeeUserId}
              onChange={(e) => setPayeeUserId(e.target.value)}
              disabled={payeeOptions.length === 0}
            >
              {payeeOptions.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {getMemberOptionLabel(members, m.userId, currentUserId)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-payment-amount" className="label">
                Amount
              </label>
              <input
                id="create-payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                className="input"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="create-payment-currency" className="label">
                Currency
              </label>
              <select
                id="create-payment-currency"
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCY_OPTIONS.map((currencyOption) => (
                  <option key={currencyOption} value={currencyOption}>
                    {currencyOption}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="create-payment-paid-on" className="label">
                Paid On
              </label>
              <input
                id="create-payment-paid-on"
                type="date"
                className="input"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                required
              />
            </div>
            <div>
              <label htmlFor="create-payment-related-bill" className="label">
                Related Bill (optional)
              </label>
              <select
                id="create-payment-related-bill"
                className="input"
                value={relatedBillId}
                onChange={(e) => setRelatedBillId(e.target.value)}
              >
                <option value="">No related bill</option>
                {referenceableBills.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {bill.title} · {bill.currency} {bill.totalAmount.toFixed(2)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Reference only. Linking a bill will not mark it as paid or allocate the payment to
                bill balances.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="create-payment-note" className="label">
              Note (optional)
            </label>
            <input
              id="create-payment-note"
              className="input"
              placeholder="e.g. Rent payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Payment Summary
            </p>
            <div className="mt-2 flex flex-col gap-2 text-sm text-charcoal">
              <div className="flex items-center justify-between gap-3">
                <span>Recorded transfer</span>
                <span className="font-semibold">
                  {currency} {(parseAmountInputToCents(amount) ?? 0) > 0
                    ? centsToAmountString(parseAmountInputToCents(amount) ?? 0)
                    : '0.00'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-500">
                <span>From</span>
                <span>{getMemberOptionLabel(members, payerUserId, currentUserId)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-slate-500">
                <span>To</span>
                <span>
                  {payeeUserId ? getMemberOptionLabel(members, payeeUserId, currentUserId) : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || members.length === 0 || !payeeUserId}
            >
              {submitting ? 'Recording...' : 'Save Payment Record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
