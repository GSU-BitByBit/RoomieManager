import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckSquare,
  Users,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Clock,
  CalendarCheck,
  Wallet,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { groups as groupsApi, ApiError } from '@/lib/api';
import type { DashboardResponse } from '@/types/api';

type StatusMood = 'calm' | 'mostly-good' | 'needs-attention';

function relativeTime(date: string | null) {
  if (!date) {
    return 'Not yet';
  }

  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export default function GroupDashboardPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [resettingCode, setResettingCode] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      const data = await groupsApi.dashboard(groupId);
      setDashboard(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const copyJoinCode = async () => {
    if (!dashboard?.group.joinCode) {
      return;
    }

    await navigator.clipboard.writeText(dashboard.group.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetJoinCode = async () => {
    if (!groupId) {
      return;
    }

    setResettingCode(true);

    try {
      const result = await groupsApi.resetJoinCode(groupId);
      setDashboard((prev) =>
        prev ? { ...prev, group: { ...prev.group, joinCode: result.joinCode } } : prev,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setResettingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
        <AlertTriangle className="mb-4 h-10 w-10 text-blush-400" />
        <p className="text-sm text-blush-600">{error || 'Dashboard unavailable'}</p>
      </div>
    );
  }

  const { group, members, chores, finance, contract } = dashboard;
  const isAdmin = group.memberRole === 'ADMIN';
  const statusMood: StatusMood =
    chores.overdueCount > 2
      ? 'needs-attention'
      : chores.overdueCount > 0 || chores.dueTodayCount > 0
        ? 'mostly-good'
        : 'calm';
  const statusConfig = {
    calm: {
      label: 'On track',
      bg: 'bg-sage-50',
      text: 'text-sage-600',
      border: 'border-sage-100/60',
    },
    'mostly-good': {
      label: 'Needs review soon',
      bg: 'bg-dusty-50',
      text: 'text-dusty-600',
      border: 'border-dusty-100/60',
    },
    'needs-attention': {
      label: 'A few things need attention',
      bg: 'bg-blush-50',
      text: 'text-blush-600',
      border: 'border-blush-100/60',
    },
  }[statusMood];

  const reviewItems = [
    chores.assignedToMeDueNext7DaysCount > 0
      ? {
          id: 'assigned-to-me',
          label: `${chores.assignedToMeDueNext7DaysCount} chore${chores.assignedToMeDueNext7DaysCount > 1 ? 's' : ''} assigned to you in the next 7 days`,
          desc: 'Review what is coming up and complete the items you own.',
          actionLabel: 'Open chores',
          route: `/groups/${groupId}/chores`,
        }
      : null,
    chores.dueTodayCount > 0
      ? {
          id: 'due-today',
          label: `${chores.dueTodayCount} chore${chores.dueTodayCount > 1 ? 's are' : ' is'} due today`,
          desc: 'Focus on what needs attention before the day ends.',
          actionLabel: 'Open chores',
          route: `/groups/${groupId}/chores`,
        }
      : null,
    chores.overdueCount > 0
      ? {
          id: 'overdue-chores',
          label: `${chores.overdueCount} overdue chore${chores.overdueCount > 1 ? 's' : ''}`,
          desc: 'A few responsibilities need attention.',
          actionLabel: 'Open chores',
          route: `/groups/${groupId}/chores`,
        }
      : null,
    !contract.publishedVersion
      ? {
          id: 'start-contract',
          label: 'Create your first contract draft',
          desc: 'Define shared rules and expectations for the group.',
          actionLabel: 'Open',
          route: `/groups/${groupId}/contract`,
        }
      : null,
    contract.hasDraft
      ? {
          id: 'contract-draft',
          label: 'Contract draft is waiting',
          desc: 'Review the latest draft before publishing a new version.',
          actionLabel: 'View draft',
          route: `/groups/${groupId}/contract`,
        }
      : null,
    finance.billCount === 0
      ? {
          id: 'add-bill',
          label: 'Track your first shared expense',
          desc: 'Start tracking bills and balances once expenses come up.',
          actionLabel: 'Add bill',
          route: `/groups/${groupId}/finance`,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: string;
    label: string;
    desc: string;
    actionLabel: string;
    route: string;
  }>;

  const snapshotItems = [
    {
      id: 'bills',
      label: 'Latest bill',
      detail:
        finance.billCount > 0
          ? `${finance.billCount} bill${finance.billCount === 1 ? '' : 's'} tracked`
          : 'No bills yet',
      time: relativeTime(finance.latestBillIncurredAt),
    },
    {
      id: 'payments',
      label: 'Latest payment',
      detail:
        finance.paymentCount > 0
          ? `${finance.paymentCount} payment${finance.paymentCount === 1 ? '' : 's'} recorded`
          : 'No payments yet',
      time: relativeTime(finance.latestPaymentPaidAt),
    },
    {
      id: 'contract',
      label: 'Contract status',
      detail: contract.publishedVersion ? `Published v${contract.publishedVersion}` : 'No published contract',
      time: relativeTime(contract.updatedAt),
    },
    {
      id: 'chores',
      label: 'Chore window',
      detail:
        chores.dueNext7DaysCount > 0
          ? `${chores.dueNext7DaysCount} due in the next 7 days`
          : 'No chores due in the next week',
      time:
        chores.overdueCount > 0
          ? `${chores.overdueCount} overdue`
          : chores.dueTodayCount > 0
            ? `${chores.dueTodayCount} due today`
            : chores.assignedToMeDueNext7DaysCount > 0
              ? `${chores.assignedToMeDueNext7DaysCount} yours soon`
              : 'All caught up',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sage-50/80 via-cream-100/50 to-dusty-50/60 p-6 sm:p-8">
        <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/4 -translate-y-1/3 rounded-full bg-sage-100/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-40 w-40 -translate-x-1/4 translate-y-1/3 rounded-full bg-blush-100/20 blur-3xl" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl text-charcoal sm:text-3xl">{group.name}</h1>
            <p className="mt-1 text-slate-500">
              {members.totalActive} active member{members.totalActive === 1 ? '' : 's'} in this group
            </p>
          </div>

          <div
            className={`inline-flex self-start rounded-full border px-4 py-2 text-sm font-medium ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
          >
            {statusConfig.label}
          </div>
        </div>

        <div className="relative mt-5 flex flex-wrap items-center gap-2">
          <span className={isAdmin ? 'badge-blue' : 'badge-green'}>
            {isAdmin ? 'Admin' : 'Member'}
          </span>
          <span className="badge-gray">{members.memberCount} member seats</span>
          <span className="badge-gray">{chores.dueNext7DaysCount} due in 7 days</span>
          {chores.overdueCount > 0 && (
            <span className="badge-red">{chores.overdueCount} overdue</span>
          )}
        </div>

        {isAdmin && group.joinCode && (
          <div className="relative mt-5 flex items-center gap-3 rounded-2xl border border-sage-100/40 bg-white/60 px-4 py-3 backdrop-blur-sm">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Invite code
              </p>
              <code className="text-base font-mono font-bold tracking-widest text-charcoal">
                {group.joinCode}
              </code>
            </div>

            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => void copyJoinCode()}
                className="rounded-xl p-2 text-slate-400 transition-all hover:bg-sage-50 hover:text-sage-600"
                title="Copy code"
              >
                {copied ? <Check size={16} className="text-sage-500" /> : <Copy size={16} />}
              </button>
              <button
                onClick={() => void resetJoinCode()}
                disabled={resettingCode}
                className="rounded-xl p-2 text-slate-400 transition-all hover:bg-sage-50 hover:text-sage-600 disabled:opacity-50"
                title="Rotate code"
              >
                <RefreshCw size={16} className={resettingCode ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          icon={<Users size={20} />}
          iconBg="bg-dusty-50"
          iconColor="text-dusty-500"
          title="Members"
          value={String(members.totalActive)}
          subtitle={`${members.adminCount} admin${members.adminCount === 1 ? '' : 's'}`}
          onClick={() => navigate(`/groups/${groupId}/members`)}
        />
        <OverviewCard
          icon={<CheckSquare size={20} />}
          iconBg="bg-sage-50"
          iconColor="text-sage-500"
          title="Due Soon"
          value={String(chores.dueNext7DaysCount)}
          subtitle={
            chores.overdueCount > 0
              ? `${chores.overdueCount} overdue`
              : chores.dueTodayCount > 0
                ? `${chores.dueTodayCount} due today`
                : 'Nothing overdue'
          }
          subtitleColor={chores.overdueCount > 0 ? 'text-blush-500' : undefined}
          badge={
            chores.assignedToMeDueNext7DaysCount > 0
              ? `${chores.assignedToMeDueNext7DaysCount} yours`
              : undefined
          }
          onClick={() => navigate(`/groups/${groupId}/chores`)}
        />
        <OverviewCard
          icon={<Wallet size={20} />}
          iconBg="bg-dusty-50"
          iconColor="text-dusty-500"
          title="Finance"
          value={String(finance.billCount)}
          subtitle={`${finance.paymentCount} payment${finance.paymentCount === 1 ? '' : 's'}`}
          onClick={() => navigate(`/groups/${groupId}/finance`)}
        />
        <OverviewCard
          icon={<FileText size={20} />}
          iconBg="bg-lavender-50"
          iconColor="text-lavender-500"
          title="Contract"
          value={contract.publishedVersion ? `v${contract.publishedVersion}` : 'Draft'}
          subtitle={contract.hasDraft ? 'Draft in progress' : 'No draft yet'}
          onClick={() => navigate(`/groups/${groupId}/contract`)}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <div className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg text-charcoal">Group Snapshot</h2>
            <div className="space-y-3">
              {snapshotItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl border border-sage-100/30 bg-cream-50/60 p-3.5"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-50 text-sage-500">
                    <CalendarCheck size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-charcoal">{item.label}</p>
                    <p className="text-xs text-slate-400">{item.detail}</p>
                  </div>
                  <span className="mt-0.5 shrink-0 whitespace-nowrap text-[11px] text-slate-400">
                    {item.time}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {reviewItems.length > 0 && (
            <div className="card p-5 sm:p-6">
              <h2 className="mb-4 font-display text-lg text-charcoal">Action Items</h2>
              <div className="space-y-3">
                {reviewItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-2xl border border-sage-100/30 bg-cream-50/60 p-3.5 transition-all duration-200 hover:border-sage-200/60"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-dusty-50">
                      <Clock size={16} className="text-dusty-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-charcoal">{item.label}</p>
                      <p className="text-xs text-slate-400">{item.desc}</p>
                    </div>
                    <button
                      onClick={() => navigate(item.route)}
                      className="shrink-0 rounded-lg bg-sage-50 px-3 py-1.5 text-xs font-medium text-sage-600 transition-all duration-200 hover:bg-sage-100 hover:text-sage-700"
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="card p-5 sm:p-6">
            <h2 className="mb-4 font-display text-lg text-charcoal">Group Status</h2>
            <div className="space-y-4">
              <StatusRow
                label="Overall status"
                value={
                  statusMood === 'calm'
                    ? 'On track'
                    : statusMood === 'mostly-good'
                      ? 'Watch today'
                      : 'Needs attention'
                }
                dots={statusMood === 'calm' ? 5 : statusMood === 'mostly-good' ? 3 : 1}
              />
              <StatusRow label="Members" value={`${members.totalActive} active`} />
              <StatusRow label="Due today" value={`${chores.dueTodayCount} scheduled`} />
              <StatusRow label="Overdue chores" value={`${chores.overdueCount} open`} />
              <StatusRow
                label="Contract"
                value={contract.publishedVersion ? `Published v${contract.publishedVersion}` : 'Not published'}
              />
              <StatusRow label="Your role" value={isAdmin ? 'Admin' : 'Member'} />
            </div>
          </div>

          <div className="card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-charcoal">Quick Actions</h2>
            </div>
            <div className="space-y-3">
              <QuickAction
                label="Manage chores"
                description={
                  isAdmin
                    ? 'Assigned list, calendar view, and recurring setup.'
                    : 'Assigned list and calendar view for your chores.'
                }
                onClick={() => navigate(`/groups/${groupId}/chores`)}
              />
              <QuickAction
                label="Track finances"
                description="Bills, payments, and balances."
                onClick={() => navigate(`/groups/${groupId}/finance`)}
              />
              <QuickAction
                label="Manage members"
                description="Roles, members, and invite access."
                onClick={() => navigate(`/groups/${groupId}/members`)}
              />
              <QuickAction
                label="Open contract"
                description="Draft, publish, and review group rules."
                onClick={() => navigate(`/groups/${groupId}/contract`)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  icon,
  iconBg,
  iconColor,
  title,
  value,
  subtitle,
  subtitleColor,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  value: string;
  subtitle: string;
  subtitleColor?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group card p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sage-100/25"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <ArrowRight size={14} className="text-slate-300 transition-colors group-hover:text-sage-400" />
      </div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className="mt-0.5 text-2xl font-bold text-charcoal">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`text-xs ${subtitleColor || 'text-slate-400'}`}>{subtitle}</span>
        {badge && (
          <span className="badge-red">
            {badge}
          </span>
        )}
      </div>
    </button>
  );
}

function StatusRow({
  label,
  value,
  dots,
}: {
  label: string;
  value: string;
  dots?: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {dots !== undefined && (
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((dot) => (
              <div
                key={dot}
                className={`h-1.5 w-1.5 rounded-full ${dot <= dots ? 'bg-sage-400' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        )}
        <span className="text-sm font-medium text-charcoal">{value}</span>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-sage-100/30 bg-cream-50/60 p-3.5 text-left transition-all duration-200 hover:border-sage-200/60 hover:bg-sage-50/40"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sage-50">
        <ArrowRight size={16} className="text-sage-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </button>
  );
}
