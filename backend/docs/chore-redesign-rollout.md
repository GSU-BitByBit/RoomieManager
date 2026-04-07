# Chore Redesign Rollout

This runbook covers the safe rollout of the assigned-based recurring chores redesign.

## Why this rollout is guarded

The legacy chores table allowed data that is invalid under the redesigned domain:

- `assigned_to_user_id` could be `NULL`
- `due_date` could be `NULL`
- `due_date` used timestamp semantics instead of date-only semantics
- pending chores could still point at inactive members
- some completion history may be missing a completion actor

The redesign does **not** silently invent assignees or due dates. If legacy rows still violate the new invariants, the Prisma migration aborts with an explicit error and no partial changes are committed.

## Rollout strategy

This repo uses a **preflight audit + guarded contract migration** strategy.

Why this is the best fit for the current codebase:

- the backend service layer is already implemented against the redesigned schema
- keeping a long-lived transitional schema in Prisma would create extra drift and runtime risk
- the missing safety piece is legacy-data remediation, not new domain design

## What is auto-remediated

The checked-in migration automatically does the following:

- preserves all legacy chores as one-off occurrences by leaving `template_id = NULL`
- creates the `chore_templates` table for future recurring templates
- converts legacy `due_date` values from `TIMESTAMP` to `DATE` using `due_date::date`
- backfills `completed_by_user_id` from the most recent `COMPLETED` `chore_activity.actor_user_id` when available

## What blocks rollout and requires manual cleanup

The migration blocks if any legacy chore has:

- missing assignee
- missing due date
- assignee that is not a group member
- assignee that is inactive while the chore is still `PENDING`
- `status = COMPLETED` with missing `completed_at`
- `status = PENDING` with non-null `completed_at`

Completed chores assigned to inactive members do **not** block rollout. Those are preserved as historical records.

## What is intentionally not inferred

- No recurring templates are auto-created from legacy chores.
- No assignees are inferred from activity logs or completion actors.
- No missing due dates are synthesized.

Recurring templates must be created intentionally by admins after the redesign is live.

## Operator steps

1. Back up the database.
2. Run the preflight audit:

   ```bash
   cd backend
   pnpm chores:redesign:audit
   ```

   For a machine-readable report that does not fail the shell on blockers:

   ```bash
   pnpm chores:redesign:audit:json
   ```

3. If blockers are reported, resolve them manually before migrating.
4. Apply the migration:

   ```bash
   pnpm prisma:migrate:deploy
   ```

5. Re-run the audit to confirm the rollout is clean:

   ```bash
   pnpm chores:redesign:audit
   ```

6. Run backend verification for the chores and groups modules:

   ```bash
   pnpm lint
   pnpm test -- --runInBand test/modules/chores/chore-redesign-remediation.spec.ts test/modules/chores/chore-generation.service.spec.ts test/modules/chores/chores.service.spec.ts test/modules/groups/groups.service.spec.ts
   pnpm build
   ```

## Manual cleanup guidance

For each blocker category:

- Missing assignee:
  Choose the correct active group member and update the row explicitly. Do not infer from completion history.

- Missing due date:
  Set the correct calendar day explicitly. Do not default to `CURRENT_DATE`.

- Assignee not in group:
  Reassign the chore to the correct active member, or correct the membership data if the assignment is truly historical and the membership row is missing by mistake.

- Pending chore assigned to inactive member:
  Reassign the chore to an active member or resolve the chore before migrating.

- Completed chore missing `completed_at`:
  Restore the correct completion timestamp from audit history or product knowledge.

- Pending chore with `completed_at`:
  Either clear the timestamp or mark the chore completed in a way that preserves historical intent.

## Expected audit exit codes

- `0`: no blockers found
- `2`: blockers found; migration is not rollout-safe yet
- `1`: operational failure while running the audit
