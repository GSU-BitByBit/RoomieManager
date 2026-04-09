export const CHORE_REDESIGN_BLOCKER_CODES = [
  'MISSING_ASSIGNEE',
  'MISSING_DUE_DATE',
  'ASSIGNEE_NOT_GROUP_MEMBER',
  'PENDING_ASSIGNEE_INACTIVE',
  'COMPLETED_MISSING_COMPLETED_AT',
  'PENDING_HAS_COMPLETED_AT'
] as const;

export type ChoreRedesignBlockerCode = (typeof CHORE_REDESIGN_BLOCKER_CODES)[number];

export const CHORE_REDESIGN_AUTO_REMEDIATION_CODES = [
  'CONVERT_DUE_DATE_TO_DATE_ONLY',
  'BACKFILL_COMPLETED_BY_USER_ID_FROM_ACTIVITY'
] as const;

export type ChoreRedesignAutoRemediationCode =
  (typeof CHORE_REDESIGN_AUTO_REMEDIATION_CODES)[number];

export const CHORE_REDESIGN_WARNING_CODES = [
  'COMPLETED_ASSIGNEE_INACTIVE_HISTORY_ALLOWED',
  'COMPLETED_BY_USER_ID_NOT_BACKFILLABLE'
] as const;

export type ChoreRedesignWarningCode = (typeof CHORE_REDESIGN_WARNING_CODES)[number];

export type LegacyChoreMembershipState = 'ACTIVE' | 'INACTIVE' | 'MISSING' | null;

export interface LegacyChoreAuditRow {
  id: string;
  groupId: string;
  status: string;
  assignedToUserId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  completedByUserId?: string | null;
  membershipState: LegacyChoreMembershipState;
  latestCompletedActivityActorUserId: string | null;
}

export interface LegacyChoreClassification {
  blockers: ChoreRedesignBlockerCode[];
  autoRemediations: ChoreRedesignAutoRemediationCode[];
  warnings: ChoreRedesignWarningCode[];
}

export interface LegacyChoreAuditSummaryItem {
  id: string;
  groupId: string;
  status: string;
  assignedToUserId: string | null;
  dueDate: string | null;
  completedAt: string | null;
}

export interface LegacyChoreAuditSummary {
  totalChoreCount: number;
  blockerCounts: Record<ChoreRedesignBlockerCode, number>;
  autoRemediationCounts: Record<ChoreRedesignAutoRemediationCode, number>;
  warningCounts: Record<ChoreRedesignWarningCode, number>;
  blockerSamples: Record<ChoreRedesignBlockerCode, LegacyChoreAuditSummaryItem[]>;
}

function initializeCountRecord<T extends string>(codes: readonly T[]): Record<T, number> {
  return codes.reduce(
    (counts, code) => ({
      ...counts,
      [code]: 0
    }),
    {} as Record<T, number>
  );
}

function initializeSampleRecord<T extends string>(
  codes: readonly T[]
): Record<T, LegacyChoreAuditSummaryItem[]> {
  return codes.reduce(
    (samples, code) => ({
      ...samples,
      [code]: []
    }),
    {} as Record<T, LegacyChoreAuditSummaryItem[]>
  );
}

function toSummaryItem(row: LegacyChoreAuditRow): LegacyChoreAuditSummaryItem {
  return {
    id: row.id,
    groupId: row.groupId,
    status: row.status,
    assignedToUserId: row.assignedToUserId,
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null
  };
}

export function classifyLegacyChoreForRedesign(
  row: LegacyChoreAuditRow
): LegacyChoreClassification {
  const blockers: ChoreRedesignBlockerCode[] = [];
  const autoRemediations: ChoreRedesignAutoRemediationCode[] = [];
  const warnings: ChoreRedesignWarningCode[] = [];

  if (!row.assignedToUserId) {
    blockers.push('MISSING_ASSIGNEE');
  }

  if (!row.dueDate) {
    blockers.push('MISSING_DUE_DATE');
  } else {
    autoRemediations.push('CONVERT_DUE_DATE_TO_DATE_ONLY');
  }

  if (row.assignedToUserId && row.membershipState === 'MISSING') {
    blockers.push('ASSIGNEE_NOT_GROUP_MEMBER');
  }

  if (row.assignedToUserId && row.membershipState === 'INACTIVE') {
    if (row.status === 'PENDING') {
      blockers.push('PENDING_ASSIGNEE_INACTIVE');
    } else {
      warnings.push('COMPLETED_ASSIGNEE_INACTIVE_HISTORY_ALLOWED');
    }
  }

  if (row.status === 'COMPLETED' && !row.completedAt) {
    blockers.push('COMPLETED_MISSING_COMPLETED_AT');
  }

  if (row.status === 'PENDING' && row.completedAt) {
    blockers.push('PENDING_HAS_COMPLETED_AT');
  }

  if (row.completedAt && row.latestCompletedActivityActorUserId && !row.completedByUserId) {
    autoRemediations.push('BACKFILL_COMPLETED_BY_USER_ID_FROM_ACTIVITY');
  } else if (row.completedAt && !row.latestCompletedActivityActorUserId) {
    warnings.push('COMPLETED_BY_USER_ID_NOT_BACKFILLABLE');
  }

  return {
    blockers,
    autoRemediations,
    warnings
  };
}

export function summarizeLegacyChoreAudit(
  rows: LegacyChoreAuditRow[],
  sampleLimit = 20
): LegacyChoreAuditSummary {
  const blockerCounts = initializeCountRecord(CHORE_REDESIGN_BLOCKER_CODES);
  const autoRemediationCounts = initializeCountRecord(CHORE_REDESIGN_AUTO_REMEDIATION_CODES);
  const warningCounts = initializeCountRecord(CHORE_REDESIGN_WARNING_CODES);
  const blockerSamples = initializeSampleRecord(CHORE_REDESIGN_BLOCKER_CODES);

  for (const row of rows) {
    const classification = classifyLegacyChoreForRedesign(row);

    for (const blocker of classification.blockers) {
      blockerCounts[blocker] += 1;
      if (blockerSamples[blocker].length < sampleLimit) {
        blockerSamples[blocker].push(toSummaryItem(row));
      }
    }

    for (const autoRemediation of classification.autoRemediations) {
      autoRemediationCounts[autoRemediation] += 1;
    }

    for (const warning of classification.warnings) {
      warningCounts[warning] += 1;
    }
  }

  return {
    totalChoreCount: rows.length,
    blockerCounts,
    autoRemediationCounts,
    warningCounts,
    blockerSamples
  };
}
