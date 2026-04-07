import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { chores as choresApi, groups as groupsApi, members as membersApi, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Chore, ChoresListResponse, GroupMember, GroupSummary } from '@/types/api';
import ChoreCalendarView from '@/components/chores/ChoreCalendarView';
import RecurringTemplatesPanel from '@/components/chores/RecurringTemplatesPanel';
import {
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  CalendarDays,
  User,
  Filter,
  AlertTriangle,
  ArrowRightLeft,
  Repeat,
  X,
} from 'lucide-react';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isBefore,
  isToday,
  parseISO,
  startOfToday,
} from 'date-fns';

type ChoreFilter = 'ALL' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
type ChoreViewMode = 'occurrences' | 'calendar' | 'templates';
type ChoreSection = {
  id: string;
  title: string;
  description: string;
  items: Chore[];
};

const ACTIONABLE_WINDOW_DAYS = 7;
const ACTIONABLE_PAGE_SIZE = 100;
const HISTORY_PREVIEW_LIMIT = 6;
const HISTORY_FILTER_PAGE_SIZE = 30;

function comparePendingChores(left: Chore, right: Chore) {
  const dueComparison = left.dueOn.localeCompare(right.dueOn);
  if (dueComparison !== 0) {
    return dueComparison;
  }

  return left.createdAt.localeCompare(right.createdAt);
}

function formatDateOnly(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function buildLocalChoresResponse(groupId: string, chores: Chore[]): ChoresListResponse {
  const totalItems = chores.length;

  return {
    groupId,
    chores,
    pagination: {
      page: 1,
      pageSize: totalItems === 0 ? 1 : totalItems,
      totalItems,
      totalPages: totalItems === 0 ? 0 : 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

function buildChoreSections(chores: Chore[]): ChoreSection[] {
  const today = startOfToday();
  const actionWindowEnd = addDays(today, ACTIONABLE_WINDOW_DAYS);
  const overdue: Chore[] = [];
  const dueToday: Chore[] = [];
  const upcoming: Chore[] = [];
  const completed: Chore[] = [];
  const cancelled: Chore[] = [];

  for (const chore of chores) {
    if (chore.status === 'COMPLETED') {
      completed.push(chore);
      continue;
    }

    if (chore.status === 'CANCELLED') {
      cancelled.push(chore);
      continue;
    }

    const dueDate = parseISO(chore.dueOn);
    if (isBefore(dueDate, today)) {
      overdue.push(chore);
    } else if (isToday(dueDate)) {
      dueToday.push(chore);
    } else if (dueDate.getTime() <= actionWindowEnd.getTime()) {
      upcoming.push(chore);
    }
  }

  overdue.sort(comparePendingChores);
  dueToday.sort(comparePendingChores);
  upcoming.sort(comparePendingChores);
  completed.sort((left, right) => (right.completedAt ?? '').localeCompare(left.completedAt ?? ''));
  cancelled.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return [
    {
      id: 'overdue',
      title: 'Needs Attention',
      description: 'Past-due chores that still need to be completed.',
      items: overdue,
    },
    {
      id: 'today',
      title: 'Due Today',
      description: 'Current-day responsibilities for the group.',
      items: dueToday,
    },
    {
      id: 'upcoming',
      title: 'Next 7 Days',
      description: 'Pending chores due within the next 7 days. Use calendar for the fuller schedule.',
      items: upcoming,
    },
    {
      id: 'completed',
      title: 'Recently Completed',
      description: 'Most recent completed occurrences kept nearby for context.',
      items: completed,
    },
    {
      id: 'cancelled',
      title: 'Recent Schedule Changes',
      description: 'Recently cancelled occurrences that are no longer active.',
      items: cancelled,
    },
  ].filter((section) => section.items.length > 0);
}

function getFilteredSectionMeta(filter: Exclude<ChoreFilter, 'ALL'>): Omit<ChoreSection, 'items'> {
  switch (filter) {
    case 'PENDING':
      return {
        id: 'pending',
        title: 'Pending Chores',
        description: 'Showing overdue work, today, and the next 7 days only.',
      };
    case 'COMPLETED':
      return {
        id: 'completed',
        title: 'Completed Chores',
        description: 'Completed occurrences, sorted newest first.',
      };
    case 'CANCELLED':
      return {
        id: 'cancelled',
        title: 'Cancelled Chores',
        description: 'Cancelled occurrences, sorted by the latest schedule changes.',
      };
  }
}

function getEmptyStateCopy(statusFilter: ChoreFilter) {
  switch (statusFilter) {
    case 'ALL':
      return {
        title: 'Nothing needs attention this week',
        description:
          'No chores are overdue, due today, or due in the next 7 days. Use the calendar to browse the fuller recurring schedule.',
      };
    case 'PENDING':
      return {
        title: 'No pending chores in this window',
        description:
          'There is nothing overdue, due today, or scheduled in the next 7 days right now.',
      };
    case 'COMPLETED':
      return {
        title: 'No completed chores yet',
        description: 'Completed occurrences will show up here as the group works through them.',
      };
    case 'CANCELLED':
      return {
        title: 'No cancelled chores',
        description: 'Cancelled occurrences and schedule changes will appear here when they happen.',
      };
  }
}

export default function ChoresPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<ChoresListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [createError, setCreateError] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChoreFilter>('ALL');
  const [groupSummary, setGroupSummary] = useState<GroupSummary | null>(null);
  const [viewMode, setViewMode] = useState<ChoreViewMode>('occurrences');
  const [occurrenceRefreshToken, setOccurrenceRefreshToken] = useState(0);

  // Create chore
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDueOn, setNewDueOn] = useState('');
  const [newAssigneeUserId, setNewAssigneeUserId] = useState('');
  const [creating, setCreating] = useState(false);
  const [membersList, setMembersList] = useState<GroupMember[]>([]);
  const [editingAssigneeForId, setEditingAssigneeForId] = useState<string | null>(null);
  const [draftAssigneeUserId, setDraftAssigneeUserId] = useState('');
  const [savingAssigneeForId, setSavingAssigneeForId] = useState<string | null>(null);

  const isAdmin = groupSummary?.memberRole === 'ADMIN';
  const isCalendarView = viewMode === 'calendar';
  const isTemplatesView = viewMode === 'templates';
  const memberOptions = [...membersList].sort((left, right) => {
    if (left.userId === user?.id) return -1;
    if (right.userId === user?.id) return 1;
    return (left.displayName ?? left.userId).localeCompare(right.displayName ?? right.userId);
  });
  const hasMemberDirectory = memberOptions.length > 0;

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await membersApi.list(groupId, { pageSize: 100 });
      setMembersList(data.members);
    } catch {
      // silent
    }
  }, [groupId]);

  const fetchGroupSummary = useCallback(async () => {
    if (!groupId) return;
    try {
      const summary = await groupsApi.get(groupId);
      setGroupSummary(summary);
    } catch {
      // silent
    }
  }, [groupId]);

  const getUserLabel = useCallback(
    (userId: string) => {
      if (userId === user?.id) return 'You';
      const member = membersList.find((m) => m.userId === userId);
      return member?.displayName ?? userId.slice(0, 8) + '...';
    },
    [user?.id, membersList],
  );

  const fetchChores = useCallback(async () => {
    if (!groupId) return;
    try {
      const actionWindowEnd = formatDateOnly(addDays(startOfToday(), ACTIONABLE_WINDOW_DAYS));

      if (statusFilter === 'ALL') {
        const [pendingResult, completedResult, cancelledResult] = await Promise.all([
          choresApi.list(groupId, {
            status: 'PENDING',
            dueOnTo: actionWindowEnd,
            sortBy: 'dueOn',
            sortOrder: 'asc',
            pageSize: ACTIONABLE_PAGE_SIZE,
          }),
          choresApi.list(groupId, {
            status: 'COMPLETED',
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            pageSize: HISTORY_PREVIEW_LIMIT,
          }),
          choresApi.list(groupId, {
            status: 'CANCELLED',
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            pageSize: HISTORY_PREVIEW_LIMIT,
          }),
        ]);

        setData(
          buildLocalChoresResponse(groupId, [
            ...pendingResult.chores,
            ...completedResult.chores,
            ...cancelledResult.chores,
          ]),
        );
      } else if (statusFilter === 'PENDING') {
        const result = await choresApi.list(groupId, {
          status: 'PENDING',
          dueOnTo: actionWindowEnd,
          sortBy: 'dueOn',
          sortOrder: 'asc',
          pageSize: ACTIONABLE_PAGE_SIZE,
        });
        setData(result);
      } else {
        const result = await choresApi.list(groupId, {
          status: statusFilter,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
          pageSize: HISTORY_FILTER_PAGE_SIZE,
        });
        setData(result);
      }
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to load chores');
    } finally {
      setLoading(false);
    }
  }, [groupId, statusFilter]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchChores(), fetchMembers(), fetchGroupSummary()]).finally(() =>
      setLoading(false),
    );
  }, [fetchChores, fetchMembers, fetchGroupSummary]);

  useEffect(() => {
    if (user?.id && !newAssigneeUserId) {
      setNewAssigneeUserId(user.id);
    }
  }, [newAssigneeUserId, user?.id]);

  useEffect(() => {
    if (!isAdmin && viewMode === 'templates') {
      setViewMode('occurrences');
    }
  }, [isAdmin, viewMode]);

  useEffect(() => {
    if (viewMode !== 'occurrences' && showCreate) {
      if (viewMode === 'templates') {
        setShowCreate(false);
      }
    }
  }, [showCreate, viewMode]);

  const refreshOccurrenceViews = useCallback(async () => {
    await fetchChores();
    setOccurrenceRefreshToken((current) => current + 1);
  }, [fetchChores]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !newTitle.trim() || !newAssigneeUserId || !newDueOn) return;
    setCreating(true);
    setCreateError('');
    setError('');
    try {
      await choresApi.create(groupId, {
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        dueOn: newDueOn,
        assigneeUserId: newAssigneeUserId,
      });
      setNewTitle('');
      setNewDescription('');
      setNewDueOn('');
      setNewAssigneeUserId(user?.id ?? '');
      setShowCreate(false);
      await refreshOccurrenceViews();
    } catch (err) {
      if (err instanceof ApiError) setCreateError(err.message);
      else setCreateError('Failed to create chore');
    } finally {
      setCreating(false);
    }
  };

  const handleComplete = async (choreId: string) => {
    setError('');
    try {
      await choresApi.complete(choreId);
      await refreshOccurrenceViews();
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
    }
  };

  const openReassign = (chore: Chore) => {
    setEditingAssigneeForId(chore.id);
    setDraftAssigneeUserId(chore.assigneeUserId);
  };

  const cancelReassign = () => {
    setEditingAssigneeForId(null);
    setDraftAssigneeUserId('');
  };

  const handleReassign = async (choreId: string) => {
    if (!draftAssigneeUserId) {
      return;
    }

    setSavingAssigneeForId(choreId);
    setError('');

    try {
      await choresApi.updateAssignee(choreId, draftAssigneeUserId);
      cancelReassign();
      await refreshOccurrenceViews();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to update assignee');
      }
    } finally {
      setSavingAssigneeForId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
      </div>
    );
  }

  const choresList = data?.chores ?? [];
  const sectionedChores =
    statusFilter === 'ALL'
      ? buildChoreSections(choresList)
      : [
          {
            ...getFilteredSectionMeta(statusFilter),
            items: buildChoreSections(choresList).flatMap((section) => section.items),
          },
        ].filter((section) => section.items.length > 0);

  const pendingOwnedByMeCount = choresList.filter(
    (chore) => chore.status === 'PENDING' && chore.assigneeUserId === user?.id,
  ).length;
  const overdueCount = choresList.filter(
    (chore) =>
      chore.status === 'PENDING' && isBefore(parseISO(chore.dueOn), startOfToday()),
  ).length;
  const dueTodayCount = choresList.filter(
    (chore) => chore.status === 'PENDING' && isToday(parseISO(chore.dueOn)),
  ).length;
  const directoryWarning = !loading && !hasMemberDirectory
    ? 'Member details are temporarily unavailable. Creating, reassigning, and recurring template editing may be limited until the member directory loads.'
    : '';
  const groupContextWarning = !loading && !groupSummary
    ? 'Some group details are unavailable right now. Role-based chores controls may be limited until the group summary reloads.'
    : '';
  const showActionWindowNote = statusFilter === 'ALL' || statusFilter === 'PENDING';
  const pageSubtitle = isTemplatesView
    ? 'Weekly recurring templates stay separate from one-off occurrences so recurring setup remains easy to manage.'
    : isCalendarView
      ? 'Month view of assigned chore occurrences, with ownership and status visible at a glance.'
      : statusFilter === 'COMPLETED'
        ? 'Completed occurrences stay here as a lightweight history view.'
        : statusFilter === 'CANCELLED'
          ? 'Cancelled occurrences stay visible here for quick schedule context.'
          : 'Assigned work that is overdue, due today, or due within the next 7 days. Use calendar for the fuller recurring schedule.';
  const emptyState = getEmptyStateCopy(statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Chores</h1>
          <p className="page-subtitle">{pageSubtitle}</p>
        </div>
        {viewMode !== 'templates' && (
          <button
            onClick={() => {
              setCreateError('');
              setShowCreate(true);
            }}
            className="btn-primary"
            disabled={!hasMemberDirectory}
            title={!hasMemberDirectory ? 'Member directory unavailable' : undefined}
          >
            <Plus size={16} />
            New Chore
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-sage-100/50 bg-white/70 p-1 shadow-sm backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setViewMode('occurrences')}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
            viewMode === 'occurrences'
              ? 'bg-sage-100 text-sage-700'
              : 'text-slate-500 hover:bg-sage-50 hover:text-charcoal'
          }`}
        >
          <CheckCircle2 size={15} />
          Assigned Occurrences
        </button>
        <button
          type="button"
          onClick={() => setViewMode('calendar')}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
            viewMode === 'calendar'
              ? 'bg-sage-100 text-sage-700'
              : 'text-slate-500 hover:bg-sage-50 hover:text-charcoal'
          }`}
        >
          <CalendarDays size={15} />
          Calendar
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setViewMode('templates')}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
              viewMode === 'templates'
                ? 'bg-sage-100 text-sage-700'
                : 'text-slate-500 hover:bg-sage-50 hover:text-charcoal'
            }`}
          >
            <Repeat size={15} />
            Recurring Templates
          </button>
        )}
      </div>

      {directoryWarning && (
        <div className="rounded-2xl border border-dusty-100/60 bg-dusty-50 p-3.5 text-sm text-dusty-700">
          {directoryWarning}
        </div>
      )}

      {groupContextWarning && (
        <div className="rounded-2xl border border-dusty-100/60 bg-dusty-50 p-3.5 text-sm text-dusty-700">
          {groupContextWarning}
        </div>
      )}

      {!isCalendarView && !isTemplatesView && error && <div className="alert-error">{error}</div>}

      {isTemplatesView ? (
        <RecurringTemplatesPanel
          groupId={groupId!}
          membersList={memberOptions}
          currentUserId={user!.id}
          getUserLabel={getUserLabel}
        />
      ) : isCalendarView ? (
        <ChoreCalendarView
          groupId={groupId!}
          membersList={memberOptions}
          currentUserId={user!.id}
          isAdmin={Boolean(isAdmin)}
          getUserLabel={getUserLabel}
          refreshSignal={occurrenceRefreshToken}
          onOccurrencesChanged={refreshOccurrenceViews}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex h-9 w-9 items-center justify-center rounded-xl bg-white/60 text-slate-400 backdrop-blur-sm">
              <Filter size={16} />
            </div>
            {(['ALL', 'PENDING', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  statusFilter === s
                    ? 'bg-sage-100 text-sage-700'
                    : 'bg-white/70 text-slate-500 hover:bg-sage-50 hover:text-charcoal'
                }`}
              >
                {s === 'ALL'
                  ? 'All'
                  : s === 'PENDING'
                    ? 'Pending'
                    : s === 'COMPLETED'
                      ? 'Completed'
                      : 'Cancelled'}
              </button>
            ))}
          </div>

          {showActionWindowNote && (
            <div className="rounded-2xl border border-sage-100/50 bg-white/70 px-4 py-3 text-sm text-slate-500 shadow-sm">
              Assigned Occurrences stays intentionally short: overdue work, today, and the next 7
              days. Use Calendar for the full recurring schedule.
            </div>
          )}

          {statusFilter === 'ALL' && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Assigned To You
                </p>
                <p className="mt-1 text-2xl font-bold text-charcoal">{pendingOwnedByMeCount}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Pending chore{pendingOwnedByMeCount === 1 ? '' : 's'} you own in this action
                  window
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Due Today
                </p>
                <p className="mt-1 text-2xl font-bold text-charcoal">{dueTodayCount}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Pending occurrence{dueTodayCount === 1 ? '' : 's'} scheduled for today
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Overdue
                </p>
                <p
                  className={`mt-1 text-2xl font-bold ${
                    overdueCount > 0 ? 'text-blush-600' : 'text-charcoal'
                  }`}
                >
                  {overdueCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Pending occurrence{overdueCount === 1 ? '' : 's'} that need attention now
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl text-charcoal">Create Chore</h2>
              <button
                onClick={() => {
                  setCreateError('');
                  setShowCreate(false);
                }}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              {createError && <div className="alert-error">{createError}</div>}
              <div>
                <label htmlFor="choreTitle" className="label">
                  Title
                </label>
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
                  Description <span className="text-slate-400">(optional)</span>
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
                  Due On
                </label>
                <input
                  id="choreDueDate"
                  type="date"
                  className="input"
                  value={newDueOn}
                  onChange={(e) => setNewDueOn(e.target.value)}
                  required
                />
              </div>
              <div>
                <label htmlFor="choreAssignee" className="label">
                  Assignee
                </label>
                {isAdmin ? (
                  <>
                    <select
                      id="choreAssignee"
                      className="input"
                      value={newAssigneeUserId}
                      onChange={(e) => {
                        setCreateError('');
                        setNewAssigneeUserId(e.target.value);
                      }}
                      required
                    >
                      {memberOptions.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.displayName ?? member.userId}
                          {member.userId === user?.id ? ' (You)' : ''}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-slate-400">
                      Choose the active member who owns this one-off chore.
                    </p>
                  </>
                ) : (
                  <div className="rounded-2xl border border-sage-100/40 bg-sage-50/70 px-4 py-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      Assigned To
                    </p>
                    <p className="mt-1 text-sm font-medium text-charcoal">You</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Members can create one-off chores only for themselves.
                    </p>
                  </div>
                )}
              </div>
              <div className="rounded-2xl border border-sage-100/40 bg-cream-50/70 px-4 py-3 text-xs text-slate-500">
                One-off chores stay separate from recurring templates so daily work stays easy to
                scan. Admins can manage weekly chores from the recurring templates view.
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCreateError('');
                    setShowCreate(false);
                  }}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={creating || !hasMemberDirectory}
                >
                  {creating ? 'Creating...' : 'Create Chore'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {!isTemplatesView && (choresList.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50">
            <CheckCircle2 className="h-6 w-6 text-sage-300" />
          </div>
          <h3 className="font-display text-xl text-charcoal">{emptyState.title}</h3>
          <p className="mt-2 text-sm text-slate-500">{emptyState.description}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sectionedChores.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3 px-1">
                <div>
                  <h2 className="text-sm font-semibold text-charcoal">{section.title}</h2>
                  <p className="mt-0.5 text-xs text-slate-400">{section.description}</p>
                </div>
                <span className="badge-gray">{section.items.length}</span>
              </div>

              <div className="space-y-3">
                {section.items.map((chore) => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    currentUserId={user!.id}
                    isAdmin={isAdmin}
                    membersList={memberOptions}
                    getUserLabel={getUserLabel}
                    isReassigning={editingAssigneeForId === chore.id}
                    reassignValue={draftAssigneeUserId}
                    isSavingReassignment={savingAssigneeForId === chore.id}
                    onOpenReassign={() => openReassign(chore)}
                    onCancelReassign={cancelReassign}
                    onReassignChange={setDraftAssigneeUserId}
                    onSaveReassign={() => handleReassign(chore.id)}
                    onComplete={handleComplete}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}

function ChoreCard({
  chore,
  currentUserId,
  isAdmin,
  membersList,
  getUserLabel,
  isReassigning,
  reassignValue,
  isSavingReassignment,
  onOpenReassign,
  onCancelReassign,
  onReassignChange,
  onSaveReassign,
  onComplete,
}: {
  chore: Chore;
  currentUserId: string;
  isAdmin: boolean;
  membersList: GroupMember[];
  getUserLabel: (userId: string) => string;
  isReassigning: boolean;
  reassignValue: string;
  isSavingReassignment: boolean;
  onOpenReassign: () => void;
  onCancelReassign: () => void;
  onReassignChange: (value: string) => void;
  onSaveReassign: () => void;
  onComplete: (choreId: string) => void;
}) {
  const isCompleted = chore.status === 'COMPLETED';
  const isCancelled = chore.status === 'CANCELLED';
  const dueDate = parseISO(chore.dueOn);
  const isOverdue = chore.status === 'PENDING' && isBefore(dueDate, startOfToday());
  const isDueToday = chore.status === 'PENDING' && isToday(dueDate);
  const isAssignedToMe = chore.assigneeUserId === currentUserId;
  const canComplete = !isCompleted && !isCancelled && (isAdmin || isAssignedToMe);
  const canReassign = isAdmin && chore.status === 'PENDING';
  const overdueDays = isOverdue ? differenceInCalendarDays(startOfToday(), dueDate) : 0;
  const statusLabel = isCancelled
    ? 'Cancelled'
    : isCompleted
      ? 'Completed'
      : isDueToday
        ? 'Due today'
        : isOverdue
        ? 'Overdue'
        : 'Pending';
  const statusBadgeClass = isCancelled
    ? 'badge-gray'
    : isCompleted
      ? 'badge-green'
      : isDueToday
        ? 'badge-yellow'
        : isOverdue
        ? 'badge-red'
        : 'badge-blue';

  return (
    <div
      className={`card p-4 ${isCompleted ? 'opacity-80' : ''} ${
        isCancelled
          ? 'border-slate-200/80 bg-slate-50/70'
          : isOverdue
            ? 'border-blush-200 bg-blush-50/30'
            : ''
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
            isCompleted
              ? 'bg-sage-50 text-sage-500'
              : isCancelled
                ? 'bg-slate-100 text-slate-400'
                : isOverdue
                  ? 'bg-blush-50 text-blush-500'
                  : 'bg-cream-100 text-slate-500'
          }`}
          title={statusLabel}
        >
          {isCompleted ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3
                className={`font-medium ${
                  isCompleted ? 'line-through text-slate-500' : 'text-charcoal'
                }`}
              >
                {chore.title}
              </h3>
              {chore.description && (
                <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{chore.description}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className={isAssignedToMe ? 'badge-green' : 'badge-gray'}>
                <User size={12} />
                {isAssignedToMe ? 'Assigned to you' : getUserLabel(chore.assigneeUserId)}
              </span>
              <span className={statusBadgeClass}>{statusLabel}</span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span
              className={`flex items-center gap-1 ${
                isOverdue ? 'font-medium text-blush-500' : 'text-slate-500'
              }`}
            >
              {isOverdue && <AlertTriangle size={12} />}
              <Calendar size={12} />
              Due {format(dueDate, 'MMM d, yyyy')}
            </span>
            {isOverdue && (
              <span className="text-blush-500">
                {overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`}
              </span>
            )}
            {isDueToday && <span className="text-amber-700">Needs attention today</span>}
            {chore.templateId && <span className="badge-blue">Recurring occurrence</span>}
            {!chore.templateId && <span className="badge-gray">One-off</span>}
            {isCompleted && chore.completedAt && (
              <span className="text-sage-600">
                Completed {format(parseISO(chore.completedAt), 'MMM d, yyyy')}
              </span>
            )}
            {isCancelled && (
              <span className="text-slate-500">This occurrence is no longer active.</span>
            )}
          </div>

          {!isCompleted && !isCancelled && (
            <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-sage-100/40 bg-cream-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">
                  {isAssignedToMe
                    ? 'You own this chore'
                    : `${getUserLabel(chore.assigneeUserId)} owns this chore`}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {canComplete
                    ? 'You can mark this occurrence complete.'
                    : 'Only the assignee or an admin can complete this occurrence.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canReassign && !isReassigning && (
                  <button
                    type="button"
                    onClick={onOpenReassign}
                    className="btn-secondary btn-sm"
                  >
                    <ArrowRightLeft size={14} />
                    Reassign
                  </button>
                )}
                {canComplete && (
                  <button
                    type="button"
                    onClick={() => onComplete(chore.id)}
                    className="btn-primary btn-sm"
                  >
                    <CheckCircle2 size={14} />
                    {isAssignedToMe ? 'Mark Complete' : 'Complete'}
                  </button>
                )}
              </div>
            </div>
          )}

          {isReassigning && canReassign && (
            <div className="mt-3 rounded-2xl border border-dusty-100/60 bg-dusty-50/60 px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`reassign-${chore.id}`} className="label mb-1 text-xs">
                    Reassign Pending Occurrence
                  </label>
                  <select
                    id={`reassign-${chore.id}`}
                    className="input py-2.5"
                    value={reassignValue}
                    onChange={(event) => onReassignChange(event.target.value)}
                    disabled={isSavingReassignment}
                  >
                    {membersList.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {member.displayName ?? member.userId}
                        {member.userId === currentUserId ? ' (You)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCancelReassign}
                    className="btn-ghost btn-sm"
                    disabled={isSavingReassignment}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onSaveReassign}
                    className="btn-primary btn-sm"
                    disabled={isSavingReassignment || reassignValue === chore.assigneeUserId}
                  >
                    {isSavingReassignment ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
