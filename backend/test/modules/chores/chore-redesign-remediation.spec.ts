import {
  classifyLegacyChoreForRedesign,
  summarizeLegacyChoreAudit,
  type LegacyChoreAuditRow
} from '../../../src/modules/chores/chore-redesign-remediation';

function buildLegacyChore(overrides: Partial<LegacyChoreAuditRow> = {}): LegacyChoreAuditRow {
  return {
    id: 'chore-1',
    groupId: 'group-1',
    status: 'PENDING',
    assignedToUserId: 'user-1',
    dueDate: new Date('2026-04-05T14:30:00.000Z'),
    completedAt: null,
    completedByUserId: null,
    membershipState: 'ACTIVE',
    latestCompletedActivityActorUserId: null,
    ...overrides
  };
}

describe('chore redesign remediation helpers', () => {
  it('flags missing assignee and missing due date as blockers', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        assignedToUserId: null,
        dueDate: null
      })
    );

    expect(classification.blockers).toEqual(
      expect.arrayContaining(['MISSING_ASSIGNEE', 'MISSING_DUE_DATE'])
    );
  });

  it('blocks pending chores assigned to inactive members', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        membershipState: 'INACTIVE'
      })
    );

    expect(classification.blockers).toContain('PENDING_ASSIGNEE_INACTIVE');
  });

  it('allows completed chores assigned to inactive members as preserved history', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        status: 'COMPLETED',
        completedAt: new Date('2026-04-06T09:00:00.000Z'),
        membershipState: 'INACTIVE'
      })
    );

    expect(classification.blockers).not.toContain('PENDING_ASSIGNEE_INACTIVE');
    expect(classification.warnings).toContain('COMPLETED_ASSIGNEE_INACTIVE_HISTORY_ALLOWED');
  });

  it('blocks chores whose assignee is not a member of the group', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        membershipState: 'MISSING'
      })
    );

    expect(classification.blockers).toContain('ASSIGNEE_NOT_GROUP_MEMBER');
  });

  it('marks safe auto-remediations for due-date conversion and completion-actor backfill', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        status: 'COMPLETED',
        completedAt: new Date('2026-04-06T09:00:00.000Z'),
        completedByUserId: null,
        latestCompletedActivityActorUserId: 'user-2'
      })
    );

    expect(classification.autoRemediations).toEqual(
      expect.arrayContaining([
        'CONVERT_DUE_DATE_TO_DATE_ONLY',
        'BACKFILL_COMPLETED_BY_USER_ID_FROM_ACTIVITY'
      ])
    );
  });

  it('does not mark completion-actor backfill when completedByUserId is already present', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        status: 'COMPLETED',
        completedAt: new Date('2026-04-06T09:00:00.000Z'),
        completedByUserId: 'user-2',
        latestCompletedActivityActorUserId: 'user-2'
      })
    );

    expect(classification.autoRemediations).not.toContain(
      'BACKFILL_COMPLETED_BY_USER_ID_FROM_ACTIVITY'
    );
  });

  it('blocks completed chores that are missing completedAt', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        status: 'COMPLETED',
        completedAt: null
      })
    );

    expect(classification.blockers).toContain('COMPLETED_MISSING_COMPLETED_AT');
  });

  it('blocks pending chores that already have completedAt set', () => {
    const classification = classifyLegacyChoreForRedesign(
      buildLegacyChore({
        status: 'PENDING',
        completedAt: new Date('2026-04-06T09:00:00.000Z')
      })
    );

    expect(classification.blockers).toContain('PENDING_HAS_COMPLETED_AT');
  });

  it('summarizes blocker counts and samples for operator reporting', () => {
    const summary = summarizeLegacyChoreAudit([
      buildLegacyChore({
        id: 'missing-assignee',
        assignedToUserId: null
      }),
      buildLegacyChore({
        id: 'missing-due-date',
        dueDate: null
      }),
      buildLegacyChore({
        id: 'inactive-pending',
        membershipState: 'INACTIVE'
      })
    ]);

    expect(summary.totalChoreCount).toBe(3);
    expect(summary.blockerCounts.MISSING_ASSIGNEE).toBe(1);
    expect(summary.blockerCounts.MISSING_DUE_DATE).toBe(1);
    expect(summary.blockerCounts.PENDING_ASSIGNEE_INACTIVE).toBe(1);
    expect(summary.blockerSamples.MISSING_ASSIGNEE[0]).toEqual(
      expect.objectContaining({
        id: 'missing-assignee',
        groupId: 'group-1'
      })
    );
  });
});
