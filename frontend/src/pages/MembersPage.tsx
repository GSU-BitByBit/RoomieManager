import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Shield,
  ShieldOff,
  UserMinus,
  Users,
  Crown,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

import { members as membersApi, groups as groupsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { GroupMember, GroupSummary } from '@/types/api';

function formatRemovalDependencyError(error: ApiError) {
  const details = error.details as
    | {
        pendingOccurrenceCount?: number;
        activeTemplateCount?: number;
        pausedTemplateCount?: number;
      }
    | undefined;

  if (!details) {
    return error.message;
  }

  const pendingCount = details.pendingOccurrenceCount ?? 0;
  const activeTemplateCount = details.activeTemplateCount ?? 0;
  const pausedTemplateCount = details.pausedTemplateCount ?? 0;
  const parts = [
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

  if (parts.length === 0) {
    return error.message;
  }

  return `This member cannot be removed yet. Reassign ${parts.join(', ')} first.`;
}

export default function MembersPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [membersList, setMembersList] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
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

  const handleRemove = async (userId: string, displayName: string | null) => {
    if (!groupId) {
      return;
    }

    const name = displayName || 'this member';
    if (!window.confirm(`Remove ${name} from the group?`)) {
      return;
    }

    setActionLoading(userId);
    setError('');

    try {
      await membersApi.remove(groupId, userId);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatRemovalDependencyError(err));
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

  const admins = membersList.filter((member) => member.role === 'ADMIN');
  const members = membersList.filter((member) => member.role === 'MEMBER');

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
  onRemove: (userId: string, displayName: string | null) => void;
}) {
  const initial = (member.displayName || member.userId)[0].toUpperCase();
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
              {member.displayName || 'Unnamed member'}
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
              onClick={() => onRemove(member.userId, member.displayName)}
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
