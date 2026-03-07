import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { groups as groupsApi, ApiError } from '@/lib/api';
import type { DashboardResponse } from '@/types/api';
import {
  CheckSquare,
  DollarSign,
  Users,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';

export default function GroupDashboardPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [resettingCode, setResettingCode] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await groupsApi.dashboard(groupId);
      setDashboard(data);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const copyJoinCode = async () => {
    if (!dashboard?.group.joinCode) return;
    await navigator.clipboard.writeText(dashboard.group.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetJoinCode = async () => {
    if (!groupId) return;
    setResettingCode(true);
    try {
      const result = await groupsApi.resetJoinCode(groupId);
      setDashboard((prev) =>
        prev ? { ...prev, group: { ...prev.group, joinCode: result.joinCode } } : prev,
      );
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setResettingCode(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-400" />
        <p className="text-sm text-red-600">{error || 'Dashboard unavailable'}</p>
      </div>
    );
  }

  const { group, members, chores, finance, contract } = dashboard;
  const isAdmin = group.memberRole === 'ADMIN';

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className={isAdmin ? 'badge-blue' : 'badge-gray'}>{group.memberRole}</span>
              <span className="text-sm text-gray-500">
                {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Join code for admins */}
        {isAdmin && group.joinCode && (
          <div className="mt-4 card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invite Code
                </p>
                <code className="mt-1 text-xl font-mono font-bold text-brand-700 tracking-widest">
                  {group.joinCode}
                </code>
              </div>
              <div className="flex gap-2">
                <button onClick={copyJoinCode} className="btn-secondary btn-sm" title="Copy code">
                  {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={resetJoinCode}
                  className="btn-secondary btn-sm"
                  disabled={resettingCode}
                  title="Rotate code"
                >
                  <RefreshCw size={14} className={resettingCode ? 'animate-spin' : ''} />
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dashboard cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Members card */}
        <DashCard
          icon={<Users size={20} />}
          iconColor="text-blue-600"
          iconBg="bg-blue-100"
          title="Members"
          value={members.totalActive}
          subtitle={`${members.adminCount} admin${members.adminCount !== 1 ? 's' : ''}, ${members.memberCount} member${members.memberCount !== 1 ? 's' : ''}`}
          onClick={() => navigate(`/groups/${groupId}/members`)}
        />

        {/* Chores card */}
        <DashCard
          icon={<CheckSquare size={20} />}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-100"
          title="Chores"
          value={chores.pendingCount}
          valueLabel="pending"
          subtitle={
            chores.overdueCount > 0
              ? `${chores.overdueCount} overdue`
              : `${chores.completedCount} completed`
          }
          subtitleColor={chores.overdueCount > 0 ? 'text-red-500' : undefined}
          badge={
            chores.assignedToMePendingCount > 0
              ? `${chores.assignedToMePendingCount} mine`
              : undefined
          }
          onClick={() => navigate(`/groups/${groupId}/chores`)}
        />

        {/* Finance card */}
        <DashCard
          icon={<DollarSign size={20} />}
          iconColor="text-amber-600"
          iconBg="bg-amber-100"
          title="Finance"
          value={finance.billCount}
          valueLabel={`bill${finance.billCount !== 1 ? 's' : ''}`}
          subtitle={`${finance.paymentCount} payment${finance.paymentCount !== 1 ? 's' : ''}`}
          onClick={() => navigate(`/groups/${groupId}/finance`)}
        />

        {/* Contract card */}
        <DashCard
          icon={<FileText size={20} />}
          iconColor="text-purple-600"
          iconBg="bg-purple-100"
          title="Contract"
          value={contract.publishedVersion ?? '—'}
          valueLabel={contract.publishedVersion ? `v${contract.publishedVersion}` : ''}
          subtitle={contract.hasDraft ? 'Draft in progress' : 'No draft'}
          onClick={() => navigate(`/groups/${groupId}/contract`)}
        />
      </div>

      {/* Quick navigation */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Quick Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickLink
            label="Manage Chores"
            description="View, create, and assign chores"
            onClick={() => navigate(`/groups/${groupId}/chores`)}
          />
          <QuickLink
            label="View Finances"
            description="Bills, payments, and balances"
            onClick={() => navigate(`/groups/${groupId}/finance`)}
          />
          <QuickLink
            label="Group Members"
            description="View and manage members"
            onClick={() => navigate(`/groups/${groupId}/members`)}
          />
          <QuickLink
            label="Group Contract"
            description="Draft, publish, and view versions"
            onClick={() => navigate(`/groups/${groupId}/contract`)}
          />
        </div>
      </div>
    </div>
  );
}

function DashCard({
  icon,
  iconColor,
  iconBg,
  title,
  value,
  valueLabel,
  subtitle,
  subtitleColor,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  value: number | string;
  valueLabel?: string;
  subtitle: string;
  subtitleColor?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <div
      className="card cursor-pointer p-5 transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${iconBg}`}>
          <div className={iconColor}>{icon}</div>
        </div>
        <ArrowRight size={16} className="text-gray-300" />
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-gray-500">{title}</h3>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {valueLabel && <span className="text-sm text-gray-500">{valueLabel}</span>}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className={`text-xs ${subtitleColor || 'text-gray-500'}`}>{subtitle}</span>
          {badge && <span className="badge-yellow">{badge}</span>}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
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
      className="card flex items-center justify-between p-4 text-left transition-shadow hover:shadow-md"
    >
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <ArrowRight size={16} className="text-gray-400" />
    </button>
  );
}
