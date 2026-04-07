import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Shield,
  ShieldOff,
  UserMinus,
  Users,
  Crown,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Trash2,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

import { members as membersApi, groups as groupsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { getDisplayInitial, resolveIdentityLabel } from '@/lib/identity';
import type { GroupMember, GroupSummary } from '@/types/api';

type MembershipExitDetails = {
  pendingOccurrenceCount?: number;
  activeTemplateCount?: number;
  pausedTemplateCount?: number;
  financeBalances?: Array<{
    currency: string;
    netAmount: number;
  }>;
};

function formatMembershipExitError(error: ApiError, subject: 'member' | 'self' | 'destroy') {
  if (subject === 'destroy' && /last remaining active member/i.test(error.message)) {
    return 'You can only destroy this group when you are the last active member. Ask everyone else to leave first or remove them from the group.';
  }

  if (subject === 'self' && /at least one admin/i.test(error.message)) {
    return 'You are the last admin in this group. Promote another member to admin before leaving.';
  }

  if (subject === 'self' && /destroy the group instead/i.test(error.message)) {
    return 'You are the last active member in this group. Destroy the group instead of leaving it.';
  }

  const details = error.details as
    | MembershipExitDetails
    | undefined;

  if (!details) {
    return error.message;
  }

  const pendingCount = details.pendingOccurrenceCount ?? 0;
  const activeTemplateCount = details.activeTemplateCount ?? 0;
  const pausedTemplateCount = details.pausedTemplateCount ?? 0;
  const choreParts = [
    pendingCount > 0
      ? `${pendingCount} pending chore occurrence${pendingCount === 1 ? '' : 's'}`
      : null,
    activeTemplateCount > 0
      ? `${activeTemplateCount} active recurring template${activeTemplateCount === 1 ? '' : 's'}`
      : null,
    pausedTemplateCount > 0
      ? `${pausedTemplateCount} paused recurring template${pausedTemplateCount === 1 ? '' : 's'}`
      : null,
  ].filter(Boolean);
  const financeParts = (details.financeBalances ?? []).map((balance) => {
    const amount = `${balance.currency} ${Math.abs(balance.netAmount).toFixed(2)}`;
    if (subject === 'self') {
      return balance.netAmount > 0 ? `${amount} is still owed to you` : `you still owe ${amount}`;
    }

    return balance.netAmount > 0 ? `${amount} is still owed to this member` : `${amount} is still owed by this member`;
  });

  if (choreParts.length === 0 && financeParts.length === 0) {
    return error.message;
  }

  const actions =
    subject === 'self'
      ? [
          choreParts.length > 0 ? `Reassign ${choreParts.join(', ')}.` : null,
          financeParts.length > 0 ? `Settle ${financeParts.join(', ')}.` : null,
        ].filter(Boolean)
      : [
          choreParts.length > 0 ? `reassign ${choreParts.join(', ')}` : null,
          financeParts.length > 0 ? `settle ${financeParts.join(', ')}` : null,
        ].filter(Boolean);

  if (actions.length === 0) {
    return error.message;
  }

  if (subject === 'self') {
    return `You cannot leave this group yet. ${actions.join(' ')}`;
  }

  return `This member cannot be removed yet. ${actions.join(' and ')} first.`;
}

function getMemberDisplayLabel(member: GroupMember): string {
  return resolveIdentityLabel({
    displayName: member.displayName,
    userId: member.userId,
    fallbackLabel: 'Unknown member',
  });
}

export default function MembersPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [membersList, setMembersList] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [exitAction, setExitAction] = useState<'leave' | 'destroy' | null>(null);
  const [exitLoading, setExitLoading] = useState(false);
  const [exitError, setExitError] = useState('');
  const [copied, setCopied] = useState(false);
  const [resettingCode, setResettingCode] = useState(false);

  const fetchData = useCallback(async () => {
    if (!groupId) {
      return;
    }

    try {
      const [membersData, groupData] = await Promise.all([
        membersApi.list(groupId, { pageSize: 100 }),
        groupsApi.get(groupId),
      ]);
      setMembersList(membersData.members);
      setGroup(groupData);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load members');
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isAdmin = group?.memberRole === 'ADMIN';

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    if (!groupId) {
      return;
    }

    setActionLoading(userId);
    setError('');

    try {
      await membersApi.updateRole(groupId, userId, newRole);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update role');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string, displayLabel: string) => {
    if (!groupId) {
      return;
    }

    if (!window.confirm(`Remove ${displayLabel} from the group?`)) {
      return;
    }

    setActionLoading(userId);
    setError('');

    try {
      await membersApi.remove(groupId, userId);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatMembershipExitError(err, 'member'));
      } else {
        setError('Failed to remove member');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const copyJoinCode = async () => {
    if (!group?.joinCode) {
      return;
    }

    await navigator.clipboard.writeText(group.joinCode);
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
      setGroup((prev) => (prev ? { ...prev, joinCode: result.joinCode } : prev));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setResettingCode(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!groupId) {
      return;
    }

    setExitLoading(true);
    setExitError('');
    setError('');

    try {
      await groupsApi.leave(groupId);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setExitError(formatMembershipExitError(err, 'self'));
      } else {
        setExitError('Failed to leave the group');
      }
    } finally {
      setExitLoading(false);
    }
  };

  const handleDestroyGroup = async () => {
    if (!groupId) {
      return;
    }

    setExitLoading(true);
    setExitError('');
    setError('');

    try {
      await groupsApi.destroy(groupId);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setExitError(formatMembershipExitError(err, 'destroy'));
      } else {
        setExitError('Failed to destroy the group');
      }
    } finally {
      setExitLoading(false);
    }
  };

  const admins = membersList.filter((member) => member.role === 'ADMIN');
  const members = membersList.filter((member) => member.role === 'MEMBER');
  const currentMember = membersList.find((member) => member.userId === user?.id) ?? null;
  const isOnlyActiveMember = membersList.length === 1;
  const isLastAdmin = Boolean(isAdmin && currentMember?.role === 'ADMIN' && admins.length <= 1);
  const canDestroyGroup = Boolean(isAdmin && isOnlyActiveMember);
  const leaveRequiresAnotherAdmin = Boolean(isLastAdmin && !canDestroyGroup);
  const showExitConfirm = exitAction !== null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Members</h1>
        <p className="page-subtitle">
          {membersList.length} active member{membersList.length === 1 ? '' : 's'}
        </p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {isAdmin && group?.joinCode && (
        <div className="rounded-3xl border border-sage-100/40 bg-gradient-to-r from-sage-50/60 via-cream-100/40 to-dusty-50/50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-sm font-medium text-charcoal">Invite members</p>
              <p className="text-xs text-slate-400">
                Share this code so others can join the group
              </p>
            </div>

            <div className="flex items-center gap-2">
              <code className="rounded-xl border border-sage-100/40 bg-white/60 px-4 py-2 text-lg font-mono font-bold tracking-widest text-charcoal">
                {group.joinCode}
              </code>
              <button
                onClick={() => void copyJoinCode()}
                className="rounded-xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-sage-100/40 hover:bg-white/60 hover:text-sage-600"
                title="Copy code"
              >
                {copied ? <Check size={16} className="text-sage-500" /> : <Copy size={16} />}
              </button>
              <button
                onClick={() => void resetJoinCode()}
                disabled={resettingCode}
                className="rounded-xl border border-transparent p-2.5 text-slate-400 transition-all hover:border-sage-100/40 hover:bg-white/60 hover:text-sage-600 disabled:opacity-50"
                title="Generate new code"
              >
                <RefreshCw size={16} className={resettingCode ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      )}

      {membersList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50">
            <Users className="h-6 w-6 text-sage-300" />
          </div>
          <h3 className="font-display text-xl text-charcoal">No members yet</h3>
          <p className="mt-2 max-w-xs text-sm text-slate-400">
            Share the invite code to get your group started.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {admins.length > 0 && (
            <div>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Admins
              </h2>
              <div className="space-y-2.5">
                {admins.map((member) => (
                  <MemberCard
                    key={member.userId}
                    member={member}
                    isSelf={member.userId === user?.id}
                    isAdmin={Boolean(isAdmin)}
                    isLoading={actionLoading === member.userId}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}

          {members.length > 0 && (
            <div>
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Members
              </h2>
              <div className="space-y-2.5">
                {members.map((member) => (
                  <MemberCard
                    key={member.userId}
                    member={member}
                    isSelf={member.userId === user?.id}
                    isAdmin={Boolean(isAdmin)}
                    isLoading={actionLoading === member.userId}
                    onRoleChange={handleRoleChange}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {currentMember && (
        <div className="rounded-3xl border border-blush-100/70 bg-gradient-to-r from-blush-50/70 via-cream-100/50 to-lavender-50/40 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-blush-500 shadow-sm">
                  {canDestroyGroup ? <Trash2 size={18} /> : <LogOut size={18} />}
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-charcoal">
                    {canDestroyGroup ? 'Destroy this group' : 'Leave this group'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {canDestroyGroup
                      ? `You are the last active member in ${group?.name ?? 'this group'}. Destroying it will permanently delete the group and its chores, finance records, contract history, and membership history.`
                      : `Leaving removes your access to ${group?.name ?? 'this group'} right away. Your past activity stays in the group history, and if you join again later you will come back as a regular member.`}
                  </p>
                </div>
              </div>
              {leaveRequiresAnotherAdmin && (
                <p className="rounded-2xl border border-blush-100/80 bg-white/80 px-4 py-3 text-sm text-blush-700">
                  You are currently the last admin. Promote another member before leaving so the
                  group still has an admin.
                </p>
              )}
              {canDestroyGroup && (
                <p className="rounded-2xl border border-blush-100/80 bg-white/80 px-4 py-3 text-sm text-blush-700">
                  Group deletion is permanent. This is only available because you are the sole
                  remaining active member.
                </p>
              )}
            </div>

            {!showExitConfirm && (
              <button
                type="button"
                onClick={() => {
                  setExitAction(canDestroyGroup ? 'destroy' : 'leave');
                  setExitError('');
                }}
                disabled={leaveRequiresAnotherAdmin}
                className="shrink-0 rounded-full border border-blush-200 bg-white/85 px-4 py-2.5 text-sm font-semibold text-blush-700 transition-all hover:border-blush-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {canDestroyGroup ? 'Destroy group' : 'Leave group'}
              </button>
            )}
          </div>

          {showExitConfirm && (
            <div className="mt-5 rounded-3xl border border-blush-100/80 bg-white/85 p-5">
              <h3 className="text-sm font-semibold text-charcoal">
                {exitAction === 'destroy' ? 'Confirm group deletion' : 'Confirm leaving'}
              </h3>
              <div className="mt-2 space-y-2 text-sm text-slate-500">
                {exitAction === 'destroy' ? (
                  <>
                    <p>Destroying the group permanently removes the group and all of its data.</p>
                    <p>That includes chores, finance records, contract history, and membership records.</p>
                    <p>This cannot be undone.</p>
                  </>
                ) : (
                  <>
                    <p>Once you leave, you will lose access to this group and its pages immediately.</p>
                    <p>Your past chores, finance records, and membership history will stay preserved.</p>
                    <p>If you return later, rejoining will restore your membership as a regular member.</p>
                  </>
                )}
              </div>

              {exitError && <div className="mt-4 alert-error">{exitError}</div>}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setExitAction(null);
                    setExitError('');
                  }}
                  className="btn-secondary"
                  disabled={exitLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void (exitAction === 'destroy' ? handleDestroyGroup() : handleLeaveGroup())
                  }
                  disabled={exitLoading}
                  className="inline-flex items-center justify-center rounded-full bg-blush-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blush-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exitLoading
                    ? exitAction === 'destroy'
                      ? 'Destroying…'
                      : 'Leaving…'
                    : exitAction === 'destroy'
                      ? 'Confirm delete'
                      : 'Confirm leave'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MemberCard({
  member,
  isSelf,
  isAdmin,
  isLoading,
  onRoleChange,
  onRemove,
}: {
  member: GroupMember;
  isSelf: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  onRoleChange: (userId: string, newRole: 'ADMIN' | 'MEMBER') => void;
  onRemove: (userId: string, displayLabel: string) => void;
}) {
  const displayLabel = getMemberDisplayLabel(member);
  const initial = getDisplayInitial(displayLabel);
  const joinedAgo = formatDistanceToNow(parseISO(member.joinedAt), { addSuffix: true });
  const avatarColors =
    member.role === 'ADMIN' ? 'bg-dusty-50 text-dusty-600' : 'bg-sage-50 text-sage-600';

  return (
    <div className="group card p-4 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${avatarColors}`}>
          {member.role === 'ADMIN' ? (
            <Crown size={18} />
          ) : (
            <span className="text-sm font-bold">{initial}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-charcoal">
              {displayLabel}
            </span>
            {isSelf && <span className="badge-green">You</span>}
            <span className={member.role === 'ADMIN' ? 'badge-blue' : 'badge-gray'}>
              {member.role === 'ADMIN' ? 'Admin' : 'Member'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Joined {format(parseISO(member.joinedAt), 'MMM d, yyyy')}
            <span className="mx-1.5 text-slate-300">&middot;</span>
            {joinedAgo}
          </p>
        </div>

        {isAdmin && !isSelf && (
          <div className="flex shrink-0 gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {member.role === 'MEMBER' ? (
              <button
                onClick={() => onRoleChange(member.userId, 'ADMIN')}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-dusty-50 px-3 py-1.5 text-xs font-medium text-dusty-600 transition-all duration-200 hover:bg-dusty-100 disabled:opacity-50"
                title="Make admin"
              >
                <Shield size={12} />
                Promote
              </button>
            ) : (
              <button
                onClick={() => onRoleChange(member.userId, 'MEMBER')}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 transition-all duration-200 hover:bg-slate-100 disabled:opacity-50"
                title="Remove admin"
              >
                <ShieldOff size={12} />
                Demote
              </button>
            )}
            <button
              onClick={() => onRemove(member.userId, displayLabel)}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-lg bg-blush-50 px-2.5 py-1.5 text-xs font-medium text-blush-600 transition-all duration-200 hover:bg-blush-100 disabled:opacity-50"
              title="Remove from group"
            >
              <UserMinus size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
