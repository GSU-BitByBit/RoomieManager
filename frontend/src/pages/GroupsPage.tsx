import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, ArrowRight, Copy, Check, LogIn, Home, X, Sparkles } from 'lucide-react';

import { groups as groupsApi, ApiError } from '@/lib/api';
import type { GroupSummary } from '@/types/api';

export default function GroupsPage() {
  const navigate = useNavigate();
  const [groupsList, setGroupsList] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await groupsApi.list();
      setGroupsList(data.groups);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load groups');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newGroupName.trim()) {
      return;
    }

    setCreating(true);
    setError('');

    try {
      const group = await groupsApi.create(newGroupName.trim());
      setGroupsList((prev) => [group, ...prev]);
      setNewGroupName('');
      setShowCreate(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create group');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!joinCode.trim()) {
      return;
    }

    setJoining(true);
    setError('');

    try {
      const group = await groupsApi.join(joinCode.trim());
      setGroupsList((prev) => [group, ...prev]);
      setJoinCode('');
      setShowJoin(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to join group');
      }
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
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">My Groups</h1>
          <p className="page-subtitle">Manage your groups</p>
        </div>
        <div className="flex gap-2.5">
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

      {error && <div className="mb-6 alert-error">{error}</div>}

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl text-charcoal">Create a new group</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label htmlFor="groupName" className="label">
                  Group Name
                </label>
                <input
                  id="groupName"
                  className="input"
                  placeholder="e.g. Apartment 12A"
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  required
                  maxLength={120}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-ghost"
                >
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

      {showJoin && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl text-charcoal">Join an existing group</h2>
              <button
                onClick={() => setShowJoin(false)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label htmlFor="joinCode" className="label">
                  Join Code
                </label>
                <input
                  id="joinCode"
                  className="input font-mono uppercase tracking-wider"
                  placeholder="e.g. AB12CD34"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  required
                  minLength={4}
                  maxLength={20}
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <button type="button" onClick={() => setShowJoin(false)} className="btn-ghost">
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

      {groupsList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-sage-50">
            <Home className="h-7 w-7 text-sage-300" />
          </div>
          <h3 className="font-display text-xl text-charcoal">No groups yet</h3>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            Create a group or join one with a code.
          </p>
          <div className="mt-8 flex gap-2.5">
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {groupsList.map((group) => (
            <button
              key={group.id}
              type="button"
              className="group/card card cursor-pointer p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sage-100/30"
              onClick={() => navigate(`/groups/${group.id}`)}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-lg font-semibold text-charcoal">{group.name}</h3>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={group.memberRole === 'ADMIN' ? 'badge-blue' : 'badge-green'}>
                      {group.memberRole === 'ADMIN' ? 'Admin' : 'Member'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Users size={12} />
                      {group.memberCount}
                    </span>
                  </div>
                </div>

                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-sage-50 text-sage-400 transition-all duration-200 group-hover/card:bg-sage-100 group-hover/card:text-sage-600">
                  <ArrowRight size={16} />
                </div>
              </div>

              {group.joinCode && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-sage-100/30 bg-cream-100/60 px-3 py-2">
                  <Sparkles size={12} className="shrink-0 text-sage-400" />
                  <code className="flex-1 text-xs font-mono font-medium tracking-wider text-charcoal">
                    {group.joinCode}
                  </code>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void copyCode(group.joinCode!, group.id);
                    }}
                    className="text-slate-400 transition-colors hover:text-sage-600"
                    title="Copy invite code"
                  >
                    {copiedId === group.id ? (
                      <Check size={14} className="text-sage-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
