import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { chores as choresApi, members as membersApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Chore, ChoresListResponse, GroupMember } from '@/types/api';
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  User,
  Filter,
  AlertTriangle,
  X,
} from 'lucide-react';
import { format, isPast, parseISO } from 'date-fns';

export default function ChoresPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<ChoresListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  // Create chore
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [membersList, setMembersList] = useState<GroupMember[]>([]);

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await membersApi.list(groupId, { pageSize: 100 });
      setMembersList(data.members);
    } catch {
      // silent
    }
  }, [groupId]);

  const getUserLabel = useCallback(
    (userId: string) => {
      if (userId === user?.id) return 'me';
      const member = membersList.find((m) => m.userId === userId);
      return member?.displayName ?? userId.slice(0, 8) + '...';
    },
    [user?.id, membersList],
  );

  const fetchChores = useCallback(async () => {
    if (!groupId) return;
    try {
      const params: Record<string, unknown> = { pageSize: 50 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const result = await choresApi.list(groupId, params);
      setData(result);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load chores');
    } finally {
      setLoading(false);
    }
  }, [groupId, statusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChores(), fetchMembers()]).finally(() => setLoading(false));
  }, [fetchChores, fetchMembers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !newTitle.trim()) return;
    setCreating(true);
    setError('');
    try {
      await choresApi.create(groupId, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        dueDate: newDueDate || undefined,
      });
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      setShowCreate(false);
      fetchChores();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to create chore');
    } finally {
      setCreating(false);
    }
  };

  const handleAssign = async (choreId: string, assignToSelf: boolean) => {
    setError('');
    try {
      await choresApi.assign(choreId, assignToSelf ? user!.id : null);
      fetchChores();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const handleComplete = async (choreId: string) => {
    setError('');
    try {
      await choresApi.complete(choreId);
      fetchChores();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const choresList = data?.chores ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chores</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data?.pagination.totalItems ?? 0} total chores
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary">
          <Plus size={16} />
          New Chore
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Filters */}
      <div className="mb-4 flex items-center gap-2">
        <Filter size={16} className="text-gray-400" />
        {(['ALL', 'PENDING', 'COMPLETED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === s
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === 'ALL' ? 'All' : s === 'PENDING' ? 'Pending' : 'Completed'}
          </button>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card w-full max-w-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Chore</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="choreTitle" className="label">Title</label>
                <input
                  id="choreTitle"
                  className="input"
                  placeholder="e.g. Clean kitchen"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  maxLength={120}
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="choreDescription" className="label">
                  Description <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="choreDescription"
                  className="input min-h-[80px] resize-y"
                  placeholder="Any additional details..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="choreDueDate" className="label">
                  Due Date <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="choreDueDate"
                  type="datetime-local"
                  className="input"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating}>
                  {creating ? 'Creating...' : 'Create Chore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chores list */}
      {choresList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900">
            {statusFilter === 'ALL' ? 'No chores yet' : `No ${statusFilter.toLowerCase()} chores`}
          </h3>
          <p className="mt-1 text-sm text-gray-500">Create a chore to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {choresList.map((chore) => (
            <ChoreCard
              key={chore.id}
              chore={chore}
              currentUserId={user!.id}
              getUserLabel={getUserLabel}
              onAssign={handleAssign}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChoreCard({
  chore,
  currentUserId,
  getUserLabel,
  onAssign,
  onComplete,
}: {
  chore: Chore;
  currentUserId: string;
  getUserLabel: (userId: string) => string;
  onAssign: (choreId: string, assignToSelf: boolean) => void;
  onComplete: (choreId: string) => void;
}) {
  const isCompleted = chore.status === 'COMPLETED';
  const isOverdue = chore.dueDate && !isCompleted && isPast(parseISO(chore.dueDate));
  const isAssignedToMe = chore.assignedToUserId === currentUserId;

  return (
    <div
      className={`card p-4 ${isCompleted ? 'opacity-60' : ''} ${
        isOverdue ? 'border-red-200 bg-red-50/30' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <button
          onClick={() => !isCompleted && onComplete(chore.id)}
          disabled={isCompleted}
          className={`mt-0.5 flex-shrink-0 ${
            isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-green-400'
          }`}
          title={isCompleted ? 'Completed' : 'Mark complete'}
        >
          {isCompleted ? <CheckCircle2 size={20} /> : <Circle size={20} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3
            className={`font-medium ${isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}
          >
            {chore.title}
          </h3>
          {chore.description && (
            <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{chore.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            {chore.dueDate && (
              <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                {isOverdue && <AlertTriangle size={12} />}
                <Calendar size={12} />
                {format(parseISO(chore.dueDate), 'MMM d, yyyy h:mm a')}
              </span>
            )}
            {chore.assignedToUserId && (
              <span className="flex items-center gap-1 text-gray-500">
                <User size={12} />
                Assigned to {getUserLabel(chore.assignedToUserId)}
              </span>
            )}
            {isCompleted && chore.completedAt && (
              <span className="text-green-600">
                Completed {format(parseISO(chore.completedAt), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isCompleted && (
          <div className="flex gap-1">
            {!chore.assignedToUserId ? (
              <button
                onClick={() => onAssign(chore.id, true)}
                className="btn-secondary btn-sm"
              >
                Claim
              </button>
            ) : isAssignedToMe ? (
              <button
                onClick={() => onAssign(chore.id, false)}
                className="btn-ghost btn-sm"
              >
                Unclaim
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
