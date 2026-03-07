import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { groups as groupsApi, ApiError } from '@/lib/api';
import type { GroupSummary } from '@/types/api';
import { Plus, Users, ArrowRight, Copy, Check, LogIn } from 'lucide-react';

export default function GroupsPage() {
  const navigate = useNavigate();
  const [groupsList, setGroupsList] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create group state
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  // Join group state
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  // Copy feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await groupsApi.list();
      setGroupsList(data.groups);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const group = await groupsApi.create(newGroupName.trim());
      setGroupsList((prev) => [group, ...prev]);
      setNewGroupName('');
      setShowCreate(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setError('');
    try {
      const group = await groupsApi.join(joinCode.trim());
      setGroupsList((prev) => [group, ...prev]);
      setJoinCode('');
      setShowJoin(false);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to join group');
    } finally {
      setJoining(false);
    }
  };

  const copyCode = async (code: string, groupId: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedId(groupId);
    setTimeout(() => setCopiedId(null), 2000);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Groups</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your roommate groups
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowJoin(true)} className="btn-secondary">
            <LogIn size={16} />
            Join Group
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <Plus size={16} />
            New Group
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold">Create a new group</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="groupName" className="label">Group Name</label>
                <input
                  id="groupName"
                  className="input"
                  placeholder="e.g. Apartment 12A"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join group modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card w-full max-w-md p-6">
            <h2 className="mb-4 text-lg font-semibold">Join an existing group</h2>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label htmlFor="joinCode" className="label">Join Code</label>
                <input
                  id="joinCode"
                  className="input uppercase"
                  placeholder="e.g. AB12CD34"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  required
                  minLength={4}
                  maxLength={20}
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowJoin(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={joining}>
                  {joining ? 'Joining...' : 'Join'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Groups list */}
      {groupsList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Users className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">No groups yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create a group or join one with a code</p>
          <div className="mt-6 flex gap-2">
            <button onClick={() => setShowJoin(true)} className="btn-secondary">
              <LogIn size={16} />
              Join Group
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus size={16} />
              New Group
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupsList.map((group) => (
            <div
              key={group.id}
              className="card cursor-pointer p-5 transition-shadow hover:shadow-md"
              onClick={() => navigate(`/groups/${group.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900 truncate">{group.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={group.memberRole === 'ADMIN' ? 'badge-blue' : 'badge-gray'}>
                      {group.memberRole}
                    </span>
                    <span className="text-xs text-gray-500">
                      {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <ArrowRight size={18} className="mt-1 text-gray-400" />
              </div>

              {group.joinCode && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <span className="text-xs text-gray-500">Join code:</span>
                  <code className="flex-1 text-sm font-mono font-medium text-gray-700">
                    {group.joinCode}
                  </code>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCode(group.joinCode!, group.id);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copy code"
                  >
                    {copiedId === group.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
