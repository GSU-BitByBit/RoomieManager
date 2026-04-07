import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { finance as financeApi, members as membersApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
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
    return member?.displayName ?? userId.slice(0, 8) + '...';
  };

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
          setError={setError}
        />
      )}

      {/* Create Payment Modal */}
      {showCreatePayment && groupId && (
        <CreatePaymentModal
          groupId={groupId}
          members={membersList}
          currentUserId={user!.id}
          onClose={() => {
            setShowCreatePayment(false);
            fetchBills();
            fetchBalances();
          }}
          setError={setError}
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
                <span className="badge-gray">{bill.splitMethod}</span>
                <span>{bill.splits.length} split{bill.splits.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-charcoal">
                {bill.currency} {parseFloat(bill.totalAmount).toFixed(2)}
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
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {cb.currency} Balances
          </h3>

          <div className="grid gap-3 sm:grid-cols-2">
            {cb.memberBalances.map((mb) => {
              const net = mb.netAmount;
              const isPositive = net > 0;
              const isZero = net === 0;
              return (
                <div key={mb.userId} className="card p-4">
                  <div className="flex items-center justify-between">
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
                      {mb.userId === currentUserId && (
                        <span className="badge-blue">You</span>
                      )}
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

          {cb.settlements.length > 0 && (
            <div>
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Suggested Settlements
              </h3>
              <div className="space-y-2">
                {cb.settlements.map((s, i) => (
                  <div key={i} className="card flex items-center justify-between p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-charcoal">{getUserLabel(s.fromUserId)}</span>
                      <ArrowRightLeft size={14} className="text-slate-400" />
                      <span className="font-medium text-charcoal">{getUserLabel(s.toUserId)}</span>
                    </div>
                    <span className="font-bold text-charcoal">
                      {cb.currency} {s.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
  setError?: (e: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [paidByUserId, setPaidByUserId] = useState(currentUserId);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(totalAmount);
    if (isNaN(amount) || amount <= 0) {
      setLocalError('Enter a valid amount');
      return;
    }

    const splits = members.map((m) => ({
      userId: m.userId,
      amount: Math.round((amount / members.length) * 100) / 100,
    }));

    // Adjust rounding difference for equal splits
    if (splits.length > 0) {
      const splitSum = splits.reduce((acc, s) => acc + s.amount, 0);
      const diff = Math.round((amount - splitSum) * 100) / 100;
      if (diff !== 0) splits[0].amount += diff;
    }

    const dto: CreateBillDto = {
      title: title.trim(),
      description: description.trim() || undefined,
      totalAmount: amount,
      currency,
      paidByUserId,
      splits,
      incurredAt: new Date().toISOString(),
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
      <div className="modal-panel max-h-[90vh] max-w-lg overflow-y-auto">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              placeholder="e.g. Grocery shopping"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={160}
            />
          </div>

          <div>
            <label className="label">Description (optional)</label>
            <input
              className="input"
              placeholder="Additional notes"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount</label>
              <input
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
              <label className="label">Currency</label>
              <select
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Paid By</label>
            <select
              className="input"
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === currentUserId ? 'You' : m.displayName ?? m.userId.slice(0, 8) + '...'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-sm text-slate-500">
              Split equally among {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Bill'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreatePaymentModal({
  groupId,
  members,
  currentUserId,
  onClose,
}: {
  groupId: string;
  members: GroupMember[];
  currentUserId: string;
  onClose: () => void;
  setError?: (e: string) => void;
}) {
  const [payerUserId, setPayerUserId] = useState(currentUserId);
  const [payeeUserId, setPayeeUserId] = useState(
    members.find((m) => m.userId !== currentUserId)?.userId ?? '',
  );
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setLocalError('Enter a valid amount');
      return;
    }
    if (payerUserId === payeeUserId) {
      setLocalError('Payer and payee must be different');
      return;
    }

    const dto: CreatePaymentDto = {
      payerUserId,
      payeeUserId,
      amount: parsedAmount,
      currency,
      note: note.trim() || undefined,
      paidAt: new Date().toISOString(),
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
          <h2 className="font-display text-xl text-charcoal">Record Payment</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
          >
            <X size={20} />
          </button>
        </div>

        {localError && <div className="mb-4 alert-error">{localError}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">From (Payer)</label>
            <select
              className="input"
              value={payerUserId}
              onChange={(e) => setPayerUserId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === currentUserId ? 'You' : m.displayName ?? m.userId.slice(0, 8) + '...'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">To (Payee)</label>
            <select
              className="input"
              value={payeeUserId}
              onChange={(e) => setPayeeUserId(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.userId === currentUserId ? 'You' : m.displayName ?? m.userId.slice(0, 8) + '...'}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Amount</label>
              <input
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
              <label className="label">Currency</label>
              <select
                className="input"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Note (optional)</label>
            <input
              className="input"
              placeholder="e.g. Rent payment"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
