import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  CalendarDays,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Repeat,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import { ApiError, choreTemplates as choreTemplatesApi } from "@/lib/api";
import { resolveIdentityLabel } from "@/lib/identity";
import type {
  ChoreTemplate,
  ChoreTemplateAssignmentStrategy,
  CreateChoreTemplateDto,
  GroupMember,
  UpdateChoreTemplateDto,
} from "@/types/api";

type TemplateFormState = {
  title: string;
  description: string;
  assignmentStrategy: ChoreTemplateAssignmentStrategy;
  assigneeUserId: string;
  participantUserIds: string[];
  startsOn: string;
  endsOn: string;
  repeatEveryDays: string;
};

type TemplateSection = {
  id: string;
  title: string;
  description: string;
  items: ChoreTemplate[];
};

const TEMPLATE_STATUS_ORDER: Record<ChoreTemplate["status"], number> = {
  ACTIVE: 0,
  PAUSED: 1,
  ARCHIVED: 2,
};

function formatDateLabel(value: string | null) {
  if (!value) {
    return "Open-ended";
  }

  return format(parseISO(value), "MMM d, yyyy");
}

function formatRepeatLabel(repeatEveryDays: number) {
  return repeatEveryDays === 1 ? "Every day" : `Every ${repeatEveryDays} days`;
}

function getWeeklyHelperText(startsOn: string, repeatEveryDays: number) {
  if (repeatEveryDays !== 7) {
    return null;
  }

  return `Weekly from ${format(parseISO(startsOn), "EEEE")}`;
}

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialFormState(
  defaultAssigneeUserId: string,
): TemplateFormState {
  return {
    title: "",
    description: "",
    assignmentStrategy: "FIXED",
    assigneeUserId: defaultAssigneeUserId,
    participantUserIds: defaultAssigneeUserId ? [defaultAssigneeUserId] : [],
    startsOn: getTodayInputValue(),
    endsOn: "",
    repeatEveryDays: "7",
  };
}

function buildTemplateSections(templates: ChoreTemplate[]): TemplateSection[] {
  return [
    {
      id: "active",
      title: "Active Templates",
      description:
        "Generating assigned occurrences on the configured interval.",
      items: templates.filter((template) => template.status === "ACTIVE"),
    },
    {
      id: "paused",
      title: "Paused Templates",
      description: "Ready to resume without losing the recurring setup.",
      items: templates.filter((template) => template.status === "PAUSED"),
    },
    {
      id: "archived",
      title: "Archived Templates",
      description:
        "Kept for reference and no longer generating future occurrences.",
      items: templates.filter((template) => template.status === "ARCHIVED"),
    },
  ].filter((section) => section.items.length > 0);
}

function memberOptionLabel(member: GroupMember, currentUserId: string) {
  const baseLabel = resolveIdentityLabel({
    displayName: member.displayName,
    userId: member.userId,
    fallbackLabel: "Member",
  });
  return `${baseLabel}${member.userId === currentUserId ? " (You)" : ""}`;
}

export default function RecurringTemplatesPanel({
  groupId,
  membersList,
  currentUserId,
  getUserLabel,
}: {
  groupId: string;
  membersList: GroupMember[];
  currentUserId: string;
  getUserLabel: (userId: string) => string;
}) {
  const defaultAssigneeUserId =
    membersList.find((member) => member.userId === currentUserId)?.userId ??
    membersList[0]?.userId ??
    "";
  const canEditAssignments = membersList.length > 0;
  const [templates, setTemplates] = useState<ChoreTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [formState, setFormState] = useState<TemplateFormState>(() =>
    createInitialFormState(defaultAssigneeUserId),
  );
  const [participantCandidateUserId, setParticipantCandidateUserId] =
    useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actioningTemplateId, setActioningTemplateId] = useState<string | null>(
    null,
  );

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await choreTemplatesApi.list(groupId);
      setTemplates(response.templates);
      setError("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load recurring templates");
      }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    setLoading(true);
    void fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!formState.assigneeUserId && defaultAssigneeUserId) {
      setFormState((prev) => ({
        ...prev,
        assigneeUserId: defaultAssigneeUserId,
      }));
    }
  }, [defaultAssigneeUserId, formState.assigneeUserId]);

  const memberOptions = useMemo(
    () =>
      [...membersList].sort((left, right) =>
        memberOptionLabel(left, currentUserId).localeCompare(
          memberOptionLabel(right, currentUserId),
        ),
      ),
    [currentUserId, membersList],
  );

  const availableParticipantMembers = useMemo(
    () =>
      memberOptions.filter(
        (member) => !formState.participantUserIds.includes(member.userId),
      ),
    [formState.participantUserIds, memberOptions],
  );

  useEffect(() => {
    if (formState.assignmentStrategy !== "ROUND_ROBIN") {
      if (participantCandidateUserId) {
        setParticipantCandidateUserId("");
      }
      return;
    }

    if (
      !participantCandidateUserId ||
      !availableParticipantMembers.some(
        (member) => member.userId === participantCandidateUserId,
      )
    ) {
      setParticipantCandidateUserId(
        availableParticipantMembers[0]?.userId ?? "",
      );
    }
  }, [
    availableParticipantMembers,
    formState.assignmentStrategy,
    participantCandidateUserId,
  ]);

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((left, right) => {
        const statusComparison =
          TEMPLATE_STATUS_ORDER[left.status] -
          TEMPLATE_STATUS_ORDER[right.status];
        if (statusComparison !== 0) {
          return statusComparison;
        }

        const startComparison = left.startsOn.localeCompare(right.startsOn);
        if (startComparison !== 0) {
          return startComparison;
        }

        const intervalComparison = left.repeatEveryDays - right.repeatEveryDays;
        if (intervalComparison !== 0) {
          return intervalComparison;
        }

        const assignmentComparison = left.assignmentStrategy.localeCompare(
          right.assignmentStrategy,
        );
        if (assignmentComparison !== 0) {
          return assignmentComparison;
        }

        return left.title.localeCompare(right.title);
      }),
    [templates],
  );

  const templateSections = buildTemplateSections(sortedTemplates);
  const activeCount = templates.filter(
    (template) => template.status === "ACTIVE",
  ).length;
  const pausedCount = templates.filter(
    (template) => template.status === "PAUSED",
  ).length;
  const archivedCount = templates.filter(
    (template) => template.status === "ARCHIVED",
  ).length;
  const isEditing = editingTemplateId !== null;
  const repeatEveryDaysNumber = Number(formState.repeatEveryDays);
  const recurrencePreview =
    Number.isInteger(repeatEveryDaysNumber) && repeatEveryDaysNumber > 0
      ? formatRepeatLabel(repeatEveryDaysNumber)
      : "Choose a positive day interval";
  const weeklyPreview = formState.startsOn
    ? getWeeklyHelperText(formState.startsOn, repeatEveryDaysNumber)
    : null;

  const openCreateModal = () => {
    if (!canEditAssignments) {
      setError(
        "Member details are unavailable. Load members before creating a recurring template.",
      );
      return;
    }

    setEditingTemplateId(null);
    setFormState(createInitialFormState(defaultAssigneeUserId));
    setParticipantCandidateUserId("");
    setShowForm(true);
    setError("");
    setFormError("");
  };

  const openEditModal = (template: ChoreTemplate) => {
    if (!canEditAssignments) {
      setError(
        "Member details are unavailable. Load members before editing a recurring template.",
      );
      return;
    }

    setEditingTemplateId(template.id);
    setFormState({
      title: template.title,
      description: template.description ?? "",
      assignmentStrategy: template.assignmentStrategy,
      assigneeUserId: template.assigneeUserId ?? defaultAssigneeUserId,
      participantUserIds: template.participants
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((participant) => participant.userId),
      startsOn: template.startsOn,
      endsOn: template.endsOn ?? "",
      repeatEveryDays: String(template.repeatEveryDays),
    });
    setParticipantCandidateUserId("");
    setShowForm(true);
    setError("");
    setFormError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTemplateId(null);
    setFormState(createInitialFormState(defaultAssigneeUserId));
    setParticipantCandidateUserId("");
    setFormError("");
  };

  const handleAssignmentStrategyChange = (
    nextStrategy: ChoreTemplateAssignmentStrategy,
  ) => {
    setFormState((prev) => {
      if (nextStrategy === prev.assignmentStrategy) {
        return prev;
      }

      if (nextStrategy === "FIXED") {
        return {
          ...prev,
          assignmentStrategy: "FIXED",
          assigneeUserId:
            prev.assigneeUserId ||
            prev.participantUserIds[0] ||
            defaultAssigneeUserId,
        };
      }

      const seededParticipants =
        prev.participantUserIds.length > 0
          ? prev.participantUserIds
          : prev.assigneeUserId
            ? [prev.assigneeUserId]
            : defaultAssigneeUserId
              ? [defaultAssigneeUserId]
              : [];

      return {
        ...prev,
        assignmentStrategy: "ROUND_ROBIN",
        participantUserIds: seededParticipants,
      };
    });
  };

  const addParticipant = () => {
    if (!participantCandidateUserId) {
      return;
    }

    setFormState((prev) => {
      if (prev.participantUserIds.includes(participantCandidateUserId)) {
        return prev;
      }

      return {
        ...prev,
        participantUserIds: [
          ...prev.participantUserIds,
          participantCandidateUserId,
        ],
      };
    });
  };

  const moveParticipant = (index: number, direction: -1 | 1) => {
    setFormState((prev) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.participantUserIds.length) {
        return prev;
      }

      const participantUserIds = [...prev.participantUserIds];
      const [participant] = participantUserIds.splice(index, 1);
      participantUserIds.splice(nextIndex, 0, participant);

      return {
        ...prev,
        participantUserIds,
      };
    });
  };

  const removeParticipant = (userId: string) => {
    setFormState((prev) => ({
      ...prev,
      participantUserIds: prev.participantUserIds.filter(
        (participantUserId) => participantUserId !== userId,
      ),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formState.title.trim() || !formState.startsOn) {
      return;
    }

    const parsedRepeatEveryDays = Number(formState.repeatEveryDays);
    if (!Number.isInteger(parsedRepeatEveryDays) || parsedRepeatEveryDays < 1) {
      setFormError("Repeat every days must be a positive whole number.");
      return;
    }

    if (formState.endsOn && formState.endsOn < formState.startsOn) {
      setFormError("End date must be on or after the start date.");
      return;
    }

    if (formState.assignmentStrategy === "FIXED") {
      if (!formState.assigneeUserId) {
        setFormError("Choose an assignee for fixed recurring templates.");
        return;
      }
    } else {
      if (formState.participantUserIds.length < 2) {
        setFormError(
          "Round-robin templates require at least two participants.",
        );
        return;
      }

      if (
        new Set(formState.participantUserIds).size !==
        formState.participantUserIds.length
      ) {
        setFormError("Round-robin participants must be unique.");
        return;
      }
    }

    setSubmitting(true);
    setFormError("");

    try {
      if (isEditing && editingTemplateId) {
        const payload: UpdateChoreTemplateDto = {
          title: formState.title.trim(),
          description: formState.description.trim() || null,
          assignmentStrategy: formState.assignmentStrategy,
          startsOn: formState.startsOn,
          endsOn: formState.endsOn || null,
          repeatEveryDays: parsedRepeatEveryDays,
          ...(formState.assignmentStrategy === "FIXED"
            ? { assigneeUserId: formState.assigneeUserId }
            : { participantUserIds: formState.participantUserIds }),
        };
        await choreTemplatesApi.update(groupId, editingTemplateId, payload);
      } else {
        const payload: CreateChoreTemplateDto = {
          title: formState.title.trim(),
          description: formState.description.trim() || undefined,
          assignmentStrategy: formState.assignmentStrategy,
          startsOn: formState.startsOn,
          endsOn: formState.endsOn || undefined,
          repeatEveryDays: parsedRepeatEveryDays,
          ...(formState.assignmentStrategy === "FIXED"
            ? { assigneeUserId: formState.assigneeUserId }
            : { participantUserIds: formState.participantUserIds }),
        };
        await choreTemplatesApi.create(groupId, payload);
      }

      closeForm();
      await fetchTemplates();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else {
        setFormError(
          isEditing ? "Failed to update template" : "Failed to create template",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLifecycleAction = async (
    template: ChoreTemplate,
    action: "pause" | "resume" | "archive",
  ) => {
    if (action === "archive") {
      const confirmed = window.confirm(
        `Archive "${template.title}"? It will stop generating future occurrences.`,
      );
      if (!confirmed) {
        return;
      }
    }

    setActioningTemplateId(template.id);
    setError("");

    try {
      if (action === "pause") {
        await choreTemplatesApi.pause(groupId, template.id);
      } else if (action === "resume") {
        await choreTemplatesApi.resume(groupId, template.id);
      } else {
        await choreTemplatesApi.archive(groupId, template.id);
      }

      await fetchTemplates();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(`Failed to ${action} template`);
      }
    } finally {
      setActioningTemplateId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Admin Tools
            </p>
            <h2 className="mt-2 font-display text-2xl text-charcoal">
              Recurring Templates
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Set up interval-based chores that automatically generate assigned
              occurrences for the group. Fixed templates always go to one
              member, while round robin rotates through an ordered participant
              list.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="btn-primary"
            disabled={!canEditAssignments}
            title={
              !canEditAssignments ? "Member directory unavailable" : undefined
            }
          >
            <Plus size={16} />
            New Recurring Template
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-sage-100/50 bg-sage-50/60 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Active
            </p>
            <p className="mt-1 text-2xl font-bold text-charcoal">
              {activeCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Generating assigned occurrences now
            </p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Paused
            </p>
            <p className="mt-1 text-2xl font-bold text-charcoal">
              {pausedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Ready to resume when needed
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Archived
            </p>
            <p className="mt-1 text-2xl font-bold text-charcoal">
              {archivedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Kept for history and reference
            </p>
          </div>
        </div>
      </div>

      {!canEditAssignments && (
        <div className="rounded-2xl border border-dusty-100/60 bg-dusty-50 p-3.5 text-sm text-dusty-700">
          Member details are temporarily unavailable. Template create and edit
          actions are disabled until the member directory loads again.
        </div>
      )}

      {error && <div className="alert-error">{error}</div>}

      {loading && templates.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-sage-200 border-t-sage-500" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sage-50 text-sage-400">
            <Repeat className="h-6 w-6" />
          </div>
          <h3 className="font-display text-xl text-charcoal">
            No recurring templates yet
          </h3>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Add an interval-based template for chores like trash day, bathroom
            resets, or shared kitchen cleaning.
          </p>
          <button
            onClick={openCreateModal}
            className="btn-primary mt-5"
            disabled={!canEditAssignments}
          >
            <Plus size={16} />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {templateSections.map((section) => (
            <section key={section.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3 px-1">
                <div>
                  <h3 className="text-sm font-semibold text-charcoal">
                    {section.title}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {section.description}
                  </p>
                </div>
                <span className="badge-gray">{section.items.length}</span>
              </div>

              <div className="space-y-3">
                {section.items.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    canEditAssignments={canEditAssignments}
                    actioningTemplateId={actioningTemplateId}
                    getUserLabel={getUserLabel}
                    onArchive={() => handleLifecycleAction(template, "archive")}
                    onEdit={() => openEditModal(template)}
                    onPause={() => handleLifecycleAction(template, "pause")}
                    onResume={() => handleLifecycleAction(template, "resume")}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-backdrop">
          <div className="modal-panel max-w-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl text-charcoal">
                  {isEditing
                    ? "Edit Recurring Template"
                    : "New Recurring Template"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Templates repeat every N days and assign each occurrence
                  either to one fixed member or to an ordered round-robin
                  rotation.
                </p>
              </div>
              <button
                onClick={closeForm}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <div className="alert-error">{formError}</div>}

              <div>
                <label htmlFor="templateTitle" className="label">
                  Title
                </label>
                <input
                  id="templateTitle"
                  className="input"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Take trash bins to curb"
                  maxLength={120}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="templateDescription" className="label">
                  Description <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="templateDescription"
                  className="input min-h-[80px] resize-y"
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Add any details the assignee should know..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="templateStartsOn" className="label">
                    Starts On
                  </label>
                  <input
                    id="templateStartsOn"
                    type="date"
                    className="input"
                    value={formState.startsOn}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        startsOn: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div>
                  <label htmlFor="templateEndsOn" className="label">
                    Ends On <span className="text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="templateEndsOn"
                    type="date"
                    className="input"
                    value={formState.endsOn}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        endsOn: event.target.value,
                      }))
                    }
                  />
                </div>

                <div>
                  <label htmlFor="templateRepeatEveryDays" className="label">
                    Repeat Every
                  </label>
                  <div className="relative">
                    <input
                      id="templateRepeatEveryDays"
                      type="number"
                      min={1}
                      step={1}
                      className="input pr-16"
                      value={formState.repeatEveryDays}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          repeatEveryDays: event.target.value,
                        }))
                      }
                      required
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-slate-400">
                      days
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <p className="label">Assignment Mode</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleAssignmentStrategyChange("FIXED")}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      formState.assignmentStrategy === "FIXED"
                        ? "border-sage-300 bg-sage-50/80"
                        : "border-sage-100/60 bg-white hover:border-sage-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                      <User size={14} />
                      Fixed Assignee
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Every generated occurrence stays with one member until the
                      template changes.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleAssignmentStrategyChange("ROUND_ROBIN")
                    }
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      formState.assignmentStrategy === "ROUND_ROBIN"
                        ? "border-dusty-300 bg-dusty-50/80"
                        : "border-sage-100/60 bg-white hover:border-sage-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-charcoal">
                      <Users size={14} />
                      Round Robin
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Rotate each generated occurrence through an ordered
                      participant list.
                    </p>
                  </button>
                </div>
              </div>

              {formState.assignmentStrategy === "FIXED" ? (
                <div>
                  <label htmlFor="templateAssignee" className="label">
                    Assignee
                  </label>
                  <select
                    id="templateAssignee"
                    className="input"
                    value={formState.assigneeUserId}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        assigneeUserId: event.target.value,
                      }))
                    }
                    required
                  >
                    {memberOptions.map((member) => (
                      <option key={member.userId} value={member.userId}>
                        {memberOptionLabel(member, currentUserId)}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 rounded-2xl border border-dusty-100/60 bg-cream-50/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <label
                        htmlFor="templateParticipantPicker"
                        className="label"
                      >
                        Add Participant
                      </label>
                      <select
                        id="templateParticipantPicker"
                        className="input"
                        value={participantCandidateUserId}
                        onChange={(event) =>
                          setParticipantCandidateUserId(event.target.value)
                        }
                        disabled={availableParticipantMembers.length === 0}
                      >
                        {availableParticipantMembers.length === 0 ? (
                          <option value="">
                            All active members already added
                          </option>
                        ) : (
                          availableParticipantMembers.map((member) => (
                            <option key={member.userId} value={member.userId}>
                              {memberOptionLabel(member, currentUserId)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={addParticipant}
                      className="btn-secondary"
                      disabled={!participantCandidateUserId}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>

                  {formState.participantUserIds.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200/80 bg-white/70 px-4 py-5 text-sm text-slate-500">
                      Add at least two active members to define the rotation
                      order.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {formState.participantUserIds.map((userId, index) => (
                        <div
                          key={userId}
                          className="flex items-center justify-between gap-3 rounded-xl border border-sage-100/60 bg-white/80 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-charcoal">
                              {index + 1}. {getUserLabel(userId)}
                            </p>
                            <p className="text-xs text-slate-400">
                              {index === 0
                                ? "First generated slot"
                                : `Follows ${getUserLabel(formState.participantUserIds[index - 1])}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveParticipant(index, -1)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal disabled:opacity-40"
                              disabled={index === 0}
                              title="Move up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveParticipant(index, 1)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sage-50 hover:text-charcoal disabled:opacity-40"
                              disabled={
                                index ===
                                formState.participantUserIds.length - 1
                              }
                              title="Move down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeParticipant(userId)}
                              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blush-50 hover:text-blush-600"
                              title="Remove participant"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-slate-500">
                    Rotation is deterministic by slot order. Reordering
                    participants changes future generated assignments after the
                    template is updated.
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-sage-100/40 bg-cream-50/70 px-4 py-3 text-xs text-slate-500">
                <p className="font-medium text-charcoal">{recurrencePreview}</p>
                <p className="mt-1">
                  Starts on{" "}
                  {formState.startsOn
                    ? formatDateLabel(formState.startsOn)
                    : "—"}
                  {formState.endsOn
                    ? ` and ends on ${formatDateLabel(formState.endsOn)}`
                    : " with no end date"}
                  .
                </p>
                {weeklyPreview && <p className="mt-1">{weeklyPreview}.</p>}
                <p className="mt-1">
                  {formState.assignmentStrategy === "FIXED"
                    ? `Every generated occurrence will be assigned to ${getUserLabel(
                        formState.assigneeUserId || defaultAssigneeUserId,
                      )}.`
                    : `Future occurrences will rotate through ${formState.participantUserIds.length} participants in the order shown above.`}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeForm} className="btn-ghost">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !canEditAssignments}
                >
                  {submitting
                    ? isEditing
                      ? "Saving..."
                      : "Creating..."
                    : isEditing
                      ? "Save Changes"
                      : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  template,
  canEditAssignments,
  actioningTemplateId,
  getUserLabel,
  onArchive,
  onEdit,
  onPause,
  onResume,
}: {
  template: ChoreTemplate;
  canEditAssignments: boolean;
  actioningTemplateId: string | null;
  getUserLabel: (userId: string) => string;
  onArchive: () => void;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const isActive = template.status === "ACTIVE";
  const isPaused = template.status === "PAUSED";
  const isArchived = template.status === "ARCHIVED";
  const isActioning = actioningTemplateId === template.id;
  const statusBadgeClass = isActive
    ? "badge-green"
    : isPaused
      ? "badge-yellow"
      : "badge-gray";
  const weeklyHelper = getWeeklyHelperText(
    template.startsOn,
    template.repeatEveryDays,
  );

  return (
    <div
      className={`card p-5 ${
        isArchived
          ? "border-slate-200/70 bg-slate-50/70"
          : isPaused
            ? "border-amber-100/70 bg-amber-50/30"
            : ""
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-charcoal">
              {template.title}
            </h3>
            <span className={statusBadgeClass}>{template.status}</span>
            <span className="badge-blue">
              <Repeat size={12} />
              {formatRepeatLabel(template.repeatEveryDays)}
            </span>
            <span className="badge-gray">
              {template.assignmentStrategy === "FIXED" ? (
                <User size={12} />
              ) : (
                <Users size={12} />
              )}
              {template.assignmentStrategy === "FIXED"
                ? "Fixed"
                : "Round Robin"}
            </span>
          </div>

          {template.description && (
            <p className="max-w-2xl text-sm text-slate-500">
              {template.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <CalendarDays size={12} />
              Starts {formatDateLabel(template.startsOn)}
            </span>
            <span>
              {template.endsOn
                ? `Ends ${formatDateLabel(template.endsOn)}`
                : "No end date"}
            </span>
            {weeklyHelper && <span>{weeklyHelper}</span>}
            {template.generatedThroughOn && (
              <span>
                Generated through {formatDateLabel(template.generatedThroughOn)}
              </span>
            )}
          </div>

          {template.assignmentStrategy === "FIXED" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="badge-blue">
                <User size={12} />
                {getUserLabel(template.assigneeUserId ?? "")}
              </span>
              <span>Every occurrence stays with the same assignee.</span>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                Rotation Order
              </p>
              <div className="flex flex-wrap gap-2">
                {template.participants.map((participant, index) => (
                  <span
                    key={`${participant.userId}-${participant.sortOrder}`}
                    className="badge-gray"
                  >
                    {index + 1}. {getUserLabel(participant.userId)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            {isActive
              ? "Active templates keep future assigned occurrences ready across the current horizon."
              : isPaused
                ? "Paused templates keep their setup but stop generating future occurrences."
                : "Archived templates remain visible for history and can no longer be changed."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isArchived && (
            <button
              type="button"
              onClick={onEdit}
              className="btn-secondary btn-sm"
              disabled={!canEditAssignments}
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
          {isActive && (
            <button
              type="button"
              onClick={onPause}
              className="btn-secondary btn-sm"
              disabled={isActioning}
            >
              <PauseCircle size={14} />
              {isActioning ? "Working..." : "Pause"}
            </button>
          )}
          {isPaused && (
            <button
              type="button"
              onClick={onResume}
              className="btn-secondary btn-sm"
              disabled={isActioning}
            >
              <PlayCircle size={14} />
              {isActioning ? "Working..." : "Resume"}
            </button>
          )}
          {!isArchived && (
            <button
              type="button"
              onClick={onArchive}
              className="btn-sm inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-blush-600 transition-all duration-200 hover:bg-blush-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isActioning}
            >
              <Archive size={14} />
              {isActioning ? "Working..." : "Archive"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
