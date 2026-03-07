import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { members as membersApi, groups as groupsApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { GroupMember, GroupSummary } from '@/types/api';
import {
  Shield,
  ShieldOff,
  UserMinus,
  Users,
  Crown,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

export default function MembersPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [membersList, setMembersList] = useState<GroupMember[]>([]);
  const [group, setGroup] = useState<GroupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) return;
    try {
      const [membersData, groupData] = await Promise.all([
        membersApi.list(groupId, { pageSize: 100 }),
        groupsApi.get(groupId),
      ]);
      setMembersList(membersData.members);
      setGroup(groupData);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isAdmin = group?.memberRole === 'ADMIN';

  const handleRoleChange = async (userId: string, newRole: 'ADMIN' | 'MEMBER') => {
    if (!groupId) return;
    setActionLoading(userId);
    setError('');
    try {
      await membersApi.updateRole(groupId, userId, newRole);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to update role');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!groupId) return;
    if (!window.confirm('Remove this member from the group?')) return;
    setActionLoading(userId);
    setError('');
    try {
      await membersApi.remove(groupId, userId);
      fetchData();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Members</h1>
        <p className="mt-1 text-sm text-gray-500">
          {membersList.length} active member{membersList.length !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {membersList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">No members</h3>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {membersList.map((member) => {
            const isSelf = member.userId === user?.id;
            const isLoading = actionLoading === member.userId;
            return (
              <div key={member.userId} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {/* Avatar placeholder */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    {member.role === 'ADMIN' ? (
                      <Crown size={18} className="text-amber-500" />
                    ) : (
                      <Users size={18} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {isSelf ? 'You' : member.displayName ?? member.userId.slice(0, 8) + '...'}
                      </span>
                      {isSelf && (
                        <span className="badge-green">You</span>
                      )}
                      <span
                        className={member.role === 'ADMIN' ? 'badge-blue' : 'badge-gray'}
                      >
                        {member.role}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Joined {format(parseISO(member.joinedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Admin actions */}
                {isAdmin && !isSelf && (
                  <div className="flex gap-1">
                    {member.role === 'MEMBER' ? (
                      <button
                        onClick={() => handleRoleChange(member.userId, 'ADMIN')}
                        className="btn-secondary btn-sm"
                        disabled={isLoading}
                        title="Promote to Admin"
                      >
                        <Shield size={14} />
                        Promote
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRoleChange(member.userId, 'MEMBER')}
                        className="btn-secondary btn-sm"
                        disabled={isLoading}
                        title="Demote to Member"
                      >
                        <ShieldOff size={14} />
                        Demote
                      </button>
                    )}
                    <button
                      onClick={() => handleRemove(member.userId)}
                      className="btn-danger btn-sm"
                      disabled={isLoading}
                      title="Remove member"
                    >
                      <UserMinus size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
