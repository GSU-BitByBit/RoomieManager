import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfToday,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Repeat,
  User,
  X,
} from 'lucide-react';

import { ApiError, chores as choresApi } from '@/lib/api';
import type { ChoreCalendarOccurrence, GroupMember } from '@/types/api';
import { getMemberColorClasses } from '@/components/chores/memberColors';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MAX_EVENTS_PER_DAY = 3;

function occurrenceStatusRank(status: ChoreCalendarOccurrence['status']) {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'COMPLETED':
      return 1;
    case 'CANCELLED':
      return 2;
  }
}

function formatDateKey(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

function describeOccurrenceStatus(occurrence: ChoreCalendarOccurrence) {
  const dueDate = parseISO(occurrence.dueOn);
  const isPending = occurrence.status === 'PENDING';
  const isOverdue = isPending && isBefore(dueDate, startOfToday());
  const isDueToday = isPending && isToday(dueDate);

  if (occurrence.status === 'CANCELLED') {
    return { label: 'Cancelled', badgeClass: 'badge-gray', toneClass: 'text-slate-500' };
  }

  if (occurrence.status === 'COMPLETED') {
    return { label: 'Completed', badgeClass: 'badge-green', toneClass: 'text-sage-600' };
  }

  if (isDueToday) {
    return { label: 'Due today', badgeClass: 'badge-yellow', toneClass: 'text-amber-700' };
  }

  if (isOverdue) {
    return { label: 'Overdue', badgeClass: 'badge-red', toneClass: 'text-blush-600' };
  }

  return { label: 'Pending', badgeClass: 'badge-blue', toneClass: 'text-slate-500' };
}

function groupOccurrencesByDay(occurrences: ChoreCalendarOccurrence[]) {
  const grouped = new Map<string, ChoreCalendarOccurrence[]>();

  for (const occurrence of occurrences) {
    const current = grouped.get(occurrence.dueOn) ?? [];
    current.push(occurrence);
    grouped.set(occurrence.dueOn, current);
  }

  for (const items of grouped.values()) {
    items.sort((left, right) => {
      const statusComparison =
        occurrenceStatusRank(left.status) - occurrenceStatusRank(right.status);
      if (statusComparison !== 0) {
        return statusComparison;
      }

      const titleComparison = left.title.localeCompare(right.title);
      if (titleComparison !== 0) {
        return titleComparison;
      }

      return left.id.localeCompare(right.id);
    });
  }

  return grouped;
}

export default function ChoreCalendarView({
  groupId,
  membersList,
  currentUserId,
  isAdmin,
  getUserLabel,
  refreshSignal,
  onOccurrencesChanged,
}: {
  groupId: string;
  membersList: GroupMember[];
  currentUserId: string;
  isAdmin: boolean;
  getUserLabel: (userId: string) => string;
  refreshSignal: number;
  onOccurrencesChanged: () => Promise<void>;
}) {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [occurrences, setOccurrences] = useState<ChoreCalendarOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [selectedOccurrence, setSelectedOccurrence] = useState<ChoreCalendarOccurrence | null>(
    null,
  );
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [draftAssigneeUserId, setDraftAssigneeUserId] = useState('');
  const [submittingAction, setSubmittingAction] = useState<'complete' | 'reassign' | null>(null);

  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarStartKey = formatDateKey(calendarStart);
  const calendarEndKey = formatDateKey(calendarEnd);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);

    try {
      const response = await choresApi.calendar(groupId, calendarStartKey, calendarEndKey);
      setOccurrences(response.occurrences);
      setError('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load the chore calendar');
      }
    } finally {
      setLoading(false);
    }
  }, [calendarEndKey, calendarStartKey, groupId]);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar, refreshSignal]);

  useEffect(() => {
    if (!selectedOccurrence) {
      return;
    }

    const refreshedOccurrence = occurrences.find((occurrence) => occurrence.id === selectedOccurrence.id);
    if (!refreshedOccurrence) {
      setSelectedOccurrence(null);
      return;
    }

    setSelectedOccurrence(refreshedOccurrence);
    setDraftAssigneeUserId(refreshedOccurrence.assigneeUserId);
  }, [occurrences, selectedOccurrence]);

  const occurrencesByDay = useMemo(() => groupOccurrencesByDay(occurrences), [occurrences]);
  const calendarDays = useMemo(
    () =>
      eachDayOfInterval({ start: calendarStart, end: calendarEnd }).map((date) => ({
        date,
        dateKey: formatDateKey(date),
        occurrences: occurrencesByDay.get(formatDateKey(date)) ?? [],
      })),
    [calendarEnd, calendarStart, occurrencesByDay],
  );
  const selectedDayOccurrences = selectedDayKey ? occurrencesByDay.get(selectedDayKey) ?? [] : [];
  const monthOccurrenceCount = occurrences.filter((occurrence) =>
    isSameMonth(parseISO(occurrence.dueOn), visibleMonth),
  ).length;

  const openOccurrenceDetail = (occurrence: ChoreCalendarOccurrence) => {
    setSelectedDayKey(null);
    setSelectedOccurrence(occurrence);
    setDraftAssigneeUserId(occurrence.assigneeUserId);
    setDetailError('');
  };

  const handleComplete = async () => {
    if (!selectedOccurrence) {
      return;
    }

    setSubmittingAction('complete');
    setDetailError('');

    try {
      await choresApi.complete(selectedOccurrence.id);
      await onOccurrencesChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setDetailError(err.message);
      } else {
        setDetailError('Failed to complete occurrence');
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleReassign = async () => {
    if (!selectedOccurrence || !draftAssigneeUserId || draftAssigneeUserId === selectedOccurrence.assigneeUserId) {
      return;
    }

    setSubmittingAction('reassign');
    setDetailError('');

    try {
      await choresApi.updateAssignee(selectedOccurrence.id, draftAssigneeUserId);
      await onOccurrencesChanged();
    } catch (err) {
      if (err instanceof ApiError) {
        setDetailError(err.message);
      } else {
        setDetailError('Failed to update assignee');
      }
    } finally {
      setSubmittingAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && <div className="alert-error">{error}</div>}

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-sage-100/50 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Month View
            </p>
            <h2 className="mt-2 font-display text-2xl text-charcoal">
              {format(visibleMonth, 'MMMM yyyy')}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {monthOccurrenceCount} scheduled occurrence{monthOccurrenceCount === 1 ? '' : 's'} in
              this month. Colors stay tied to member identity so ownership is easy to scan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setVisibleMonth(startOfMonth(subMonths(visibleMonth, 1)))}
              className="btn-secondary btn-sm"
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(startOfMonth(new Date()))}
              className="btn-ghost btn-sm"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setVisibleMonth(startOfMonth(addMonths(visibleMonth, 1)))}
              className="btn-secondary btn-sm"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="border-b border-sage-100/50 bg-cream-50/70 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Circle size={12} className="text-brand-500" />
              Pending stays actionable
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-sage-500" />
              Completed stays visible for context
            </span>
            <span className="flex items-center gap-1">
              <X size={12} className="text-slate-400" />
              Cancelled is muted but still readable
            </span>
          </div>
        </div>

        {!loading && monthOccurrenceCount === 0 && (
          <div className="border-b border-sage-100/50 bg-white/70 px-5 py-4 text-sm text-slate-500 sm:px-6">
            No chore occurrences are scheduled in this month yet. One-off chores and recurring
            occurrences will appear here as soon as they land on the calendar.
          </div>
        )}

        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 border-b border-sage-100/50 bg-white/60">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day) => (
                <CalendarDayCell
                  key={day.dateKey}
                  currentUserId={currentUserId}
                  date={day.date}
                  getUserLabel={getUserLabel}
                  isCurrentMonth={isSameMonth(day.date, visibleMonth)}
                  occurrences={day.occurrences}
                  onOpenDayOverflow={() => setSelectedDayKey(day.dateKey)}
                  onOpenOccurrence={openOccurrenceDetail}
                />
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center border-t border-sage-100/50 bg-white/70 px-5 py-4 text-sm text-slate-500">
            <div className="mr-3 h-5 w-5 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
            Refreshing visible month
          </div>
        )}
      </div>

      {selectedDayKey && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-lg">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-xl text-charcoal">
                  {format(parseISO(selectedDayKey), 'EEEE, MMM d')}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedDayOccurrences.length} scheduled occurrence
                  {selectedDayOccurrences.length === 1 ? '' : 's'} for this day.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDayKey(null)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2">
              {selectedDayOccurrences.map((occurrence) => (
                <button
                  key={occurrence.id}
                  type="button"
                  onClick={() => openOccurrenceDetail(occurrence)}
                  className="w-full rounded-2xl border border-sage-100/50 bg-cream-50/60 px-4 py-3 text-left transition-all duration-200 hover:border-sage-200 hover:bg-white"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-charcoal">{occurrence.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getUserLabel(occurrence.assigneeUserId)}
                      </p>
                    </div>
                    <span className={describeOccurrenceStatus(occurrence).badgeClass}>
                      {describeOccurrenceStatus(occurrence).label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedOccurrence && (
        <OccurrenceDetailModal
          assigneeOptions={membersList}
          currentUserId={currentUserId}
          detailError={detailError}
          draftAssigneeUserId={draftAssigneeUserId}
          getUserLabel={getUserLabel}
          isAdmin={isAdmin}
          occurrence={selectedOccurrence}
          onClose={() => {
            setSelectedOccurrence(null);
            setDetailError('');
          }}
          onComplete={handleComplete}
          onReassign={handleReassign}
          onReassignChange={setDraftAssigneeUserId}
          submittingAction={submittingAction}
        />
      )}
    </div>
  );
}

function CalendarDayCell({
  date,
  isCurrentMonth,
  occurrences,
  currentUserId,
  getUserLabel,
  onOpenOccurrence,
  onOpenDayOverflow,
}: {
  date: Date;
  isCurrentMonth: boolean;
  occurrences: ChoreCalendarOccurrence[];
  currentUserId: string;
  getUserLabel: (userId: string) => string;
  onOpenOccurrence: (occurrence: ChoreCalendarOccurrence) => void;
  onOpenDayOverflow: () => void;
}) {
  const visibleOccurrences = occurrences.slice(0, MAX_EVENTS_PER_DAY);
  const remainingCount = Math.max(occurrences.length - MAX_EVENTS_PER_DAY, 0);

  return (
    <div
      className={`min-h-[148px] border-b border-r border-sage-100/50 px-2.5 py-2.5 ${
        isCurrentMonth ? 'bg-white/70' : 'bg-cream-50/60'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-medium ${
            isToday(date)
              ? 'bg-sage-100 text-sage-700'
              : isCurrentMonth
                ? 'text-charcoal'
                : 'text-slate-400'
          }`}
        >
          {format(date, 'd')}
        </span>
        {occurrences.length > 0 && (
          <span className="text-[11px] text-slate-400">{occurrences.length}</span>
        )}
      </div>

      <div className="space-y-1.5">
        {visibleOccurrences.map((occurrence) => (
          <OccurrenceChip
            key={occurrence.id}
            currentUserId={currentUserId}
            getUserLabel={getUserLabel}
            occurrence={occurrence}
            onClick={() => onOpenOccurrence(occurrence)}
          />
        ))}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={onOpenDayOverflow}
            className="w-full rounded-xl border border-dashed border-sage-100/70 px-2 py-1.5 text-left text-[11px] font-medium text-slate-500 transition-colors hover:border-sage-200 hover:bg-sage-50/50 hover:text-charcoal"
          >
            +{remainingCount} more
          </button>
        )}
      </div>
    </div>
  );
}

function OccurrenceChip({
  occurrence,
  currentUserId,
  getUserLabel,
  onClick,
}: {
  occurrence: ChoreCalendarOccurrence;
  currentUserId: string;
  getUserLabel: (userId: string) => string;
  onClick: () => void;
}) {
  const palette = getMemberColorClasses(occurrence.assigneeUserId);
  const isAssignedToCurrentUser = occurrence.assigneeUserId === currentUserId;
  const isCompleted = occurrence.status === 'COMPLETED';
  const isCancelled = occurrence.status === 'CANCELLED';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-start gap-2 rounded-xl border px-2 py-1.5 text-left transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm ${
        isCancelled
          ? 'border-slate-200/80 bg-slate-50/80 text-slate-500 hover:bg-slate-100'
          : `${palette.softBg} ${palette.softBorder} ${palette.softText}`
      }`}
    >
      <span
        className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${
          isCancelled ? 'bg-slate-300' : palette.accent
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1.5">
          {isCompleted ? (
            <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-sage-600" />
          ) : isCancelled ? (
            <X size={12} className="mt-0.5 shrink-0 text-slate-400" />
          ) : (
            <Circle size={12} className="mt-0.5 shrink-0 text-charcoal/70" />
          )}
          <span
            className={`block min-w-0 truncate text-[11px] font-medium ${
              isCompleted ? 'line-through text-slate-500' : ''
            }`}
          >
            {occurrence.title}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[10px]">
          <span className={isAssignedToCurrentUser ? 'font-medium text-charcoal' : palette.mutedText}>
            {isAssignedToCurrentUser ? 'You' : getUserLabel(occurrence.assigneeUserId)}
          </span>
          {occurrence.templateId && <Repeat size={10} className="text-slate-400" />}
        </div>
      </div>
    </button>
  );
}

function OccurrenceDetailModal({
  occurrence,
  assigneeOptions,
  currentUserId,
  detailError,
  draftAssigneeUserId,
  getUserLabel,
  isAdmin,
  onClose,
  onComplete,
  onReassign,
  onReassignChange,
  submittingAction,
}: {
  occurrence: ChoreCalendarOccurrence;
  assigneeOptions: GroupMember[];
  currentUserId: string;
  detailError: string;
  draftAssigneeUserId: string;
  getUserLabel: (userId: string) => string;
  isAdmin: boolean;
  onClose: () => void;
  onComplete: () => void;
  onReassign: () => void;
  onReassignChange: (value: string) => void;
  submittingAction: 'complete' | 'reassign' | null;
}) {
  const dueDate = parseISO(occurrence.dueOn);
  const palette = getMemberColorClasses(occurrence.assigneeUserId);
  const isAssignedToMe = occurrence.assigneeUserId === currentUserId;
  const isCompleted = occurrence.status === 'COMPLETED';
  const isCancelled = occurrence.status === 'CANCELLED';
  const canComplete = !isCompleted && !isCancelled && (isAdmin || isAssignedToMe);
  const canReassign = isAdmin && assigneeOptions.length > 0 && occurrence.status === 'PENDING';
  const statusMeta = describeOccurrenceStatus(occurrence);
  const overdueDays =
    occurrence.status === 'PENDING' && isBefore(dueDate, startOfToday())
      ? differenceInCalendarDays(startOfToday(), dueDate)
      : 0;

  return (
    <div className="modal-backdrop">
      <div className="modal-panel max-w-2xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl text-charcoal">{occurrence.title}</h3>
              <span className={statusMeta.badgeClass}>{statusMeta.label}</span>
              <span className={occurrence.templateId ? 'badge-blue' : 'badge-gray'}>
                {occurrence.templateId ? 'Recurring occurrence' : 'One-off'}
              </span>
            </div>
            {occurrence.description && (
              <p className="mt-2 max-w-xl text-sm text-slate-500">{occurrence.description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
          >
            <X size={20} />
          </button>
        </div>

        {detailError && <div className="alert-error mb-4">{detailError}</div>}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className={`rounded-2xl border px-4 py-4 ${palette.softBg} ${palette.softBorder}`}>
              <div className="flex items-start gap-3">
                <div
                  className={`mt-1 h-10 w-10 shrink-0 rounded-2xl ${palette.softBg} ${palette.softBorder} border`}
                >
                  <div className="flex h-full w-full items-center justify-center">
                    <User size={18} className={palette.softText} />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                    Assignee
                  </p>
                  <p className={`mt-1 text-base font-medium ${palette.softText}`}>
                    {isAssignedToMe ? 'You' : getUserLabel(occurrence.assigneeUserId)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ownership is fixed until an admin explicitly reassigns it.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-sage-100/50 bg-white/70 px-4 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Due On
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm font-medium text-charcoal">
                  <CalendarDays size={16} />
                  {format(dueDate, 'EEEE, MMM d, yyyy')}
                </p>
                {overdueDays > 0 && (
                  <p className="mt-2 flex items-center gap-1 text-xs font-medium text-blush-600">
                    <AlertTriangle size={12} />
                    {overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-sage-100/50 bg-white/70 px-4 py-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  Status
                </p>
                <p className={`mt-2 text-sm font-medium ${statusMeta.toneClass}`}>{statusMeta.label}</p>
                {isCompleted && occurrence.completedAt && (
                  <p className="mt-2 text-xs text-slate-500">
                    Completed {format(parseISO(occurrence.completedAt), 'MMM d, yyyy')}
                  </p>
                )}
                {isCancelled && (
                  <p className="mt-2 text-xs text-slate-500">
                    Cancelled occurrences stay visible for context but are no longer actionable.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {!isCompleted && !isCancelled && (
              <div className="rounded-2xl border border-sage-100/50 bg-cream-50/70 px-4 py-4">
                <p className="text-sm font-medium text-charcoal">Occurrence actions</p>
                <p className="mt-1 text-xs text-slate-500">
                  {canComplete
                    ? 'You can complete this occurrence from here.'
                    : 'Only the assignee or an admin can complete this occurrence.'}
                </p>
                {canComplete && (
                  <button
                    type="button"
                    onClick={onComplete}
                    className="btn-primary mt-4 w-full"
                    disabled={submittingAction !== null}
                  >
                    {submittingAction === 'complete' ? 'Saving...' : 'Mark Complete'}
                  </button>
                )}
              </div>
            )}

            {canReassign && (
              <div className="rounded-2xl border border-dusty-100/60 bg-dusty-50/60 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-medium text-charcoal">
                  <ArrowRightLeft size={15} />
                  Reassign occurrence
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Reassignment changes the live owner for this specific occurrence only.
                </p>
                <select
                  className="input mt-4"
                  value={draftAssigneeUserId}
                  onChange={(event) => onReassignChange(event.target.value)}
                  disabled={submittingAction !== null}
                >
                  {assigneeOptions.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName ?? member.userId}
                      {member.userId === currentUserId ? ' (You)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onReassign}
                  className="btn-secondary mt-3 w-full"
                  disabled={
                    submittingAction !== null || draftAssigneeUserId === occurrence.assigneeUserId
                  }
                >
                  {submittingAction === 'reassign' ? 'Saving...' : 'Save Reassignment'}
                </button>
              </div>
            )}

            {isAdmin && assigneeOptions.length === 0 && !isCancelled && (
              <div className="rounded-2xl border border-dusty-100/60 bg-dusty-50/60 px-4 py-4">
                <p className="text-sm font-medium text-charcoal">Reassignment unavailable</p>
                <p className="mt-1 text-xs text-slate-500">
                  Member details are unavailable right now, so this occurrence cannot be reassigned
                  from the calendar until the member directory loads again.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
