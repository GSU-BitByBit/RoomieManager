-- Interval recurrence + round-robin template schema upgrade
--
-- Design goals:
-- - Replace weekday-based recurrence with interval recurrence.
-- - Redefine starts_on as the first actual due occurrence date.
-- - Introduce template assignment strategy (FIXED vs ROUND_ROBIN).
-- - Add ordered template participants for round-robin assignment.
-- - Add occurrence_index for deterministic recurring slot identity.
-- - Preserve current one-off chores and preserve recurring history.
--
-- Migration rules:
-- - Existing recurring templates migrate to FIXED assignment strategy.
-- - Existing recurring templates migrate to repeat_every_days = 7.
-- - Existing starts_on values are rewritten to the first real due date implied by
--   the legacy (weekday, starts_on) pair.
-- - Existing recurring occurrences are preserved.
-- - occurrence_index is backfilled when it can be inferred safely from the
--   current template schedule.
-- - Legacy historical recurring occurrences that no longer align with the
--   current template (for example after older schedule edits) are preserved with
--   occurrence_index = NULL instead of receiving a guessed slot number.
-- - Current live recurring rows must remain inferable; otherwise the migration
--   aborts and operators must remediate first.

DO $$
BEGIN
  CREATE TYPE "ChoreTemplateAssignmentStrategy" AS ENUM ('FIXED', 'ROUND_ROBIN');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "chore_template_participants" (
  "id" TEXT NOT NULL,
  "template_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chore_template_participants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chore_templates"
  ADD COLUMN IF NOT EXISTS "assignment_strategy" "ChoreTemplateAssignmentStrategy" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN IF NOT EXISTS "repeat_every_days" INTEGER NOT NULL DEFAULT 7;

ALTER TABLE "chores"
  ADD COLUMN IF NOT EXISTS "occurrence_index" INTEGER;

DO $$
DECLARE
  empty_window_template_count BIGINT;
BEGIN
  WITH template_first_due AS (
    SELECT
      "id",
      "starts_on",
      "ends_on",
      (
        "starts_on" + (
          (
            CASE "weekday"
              WHEN 'SUNDAY' THEN 0
              WHEN 'MONDAY' THEN 1
              WHEN 'TUESDAY' THEN 2
              WHEN 'WEDNESDAY' THEN 3
              WHEN 'THURSDAY' THEN 4
              WHEN 'FRIDAY' THEN 5
              WHEN 'SATURDAY' THEN 6
            END
            - EXTRACT(DOW FROM "starts_on")::INTEGER
            + 7
          ) % 7
        )
      )::DATE AS "first_due_on"
    FROM "chore_templates"
  )
  SELECT COUNT(*)
  INTO empty_window_template_count
  FROM template_first_due
  WHERE "ends_on" IS NOT NULL
    AND "first_due_on" > "ends_on";

  IF empty_window_template_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Interval recurrence migration blocked. %s recurring template(s) have a legacy weekly window that never produced a due occurrence, so starts_on cannot be rewritten safely. Adjust or archive those templates before rerunning Prisma migrate.',
        empty_window_template_count
      );
  END IF;
END $$;

UPDATE "chore_templates"
SET
  "assignment_strategy" = 'FIXED'::"ChoreTemplateAssignmentStrategy",
  "repeat_every_days" = 7,
  "starts_on" = (
    "starts_on" + (
      (
        CASE "weekday"
          WHEN 'SUNDAY' THEN 0
          WHEN 'MONDAY' THEN 1
          WHEN 'TUESDAY' THEN 2
          WHEN 'WEDNESDAY' THEN 3
          WHEN 'THURSDAY' THEN 4
          WHEN 'FRIDAY' THEN 5
          WHEN 'SATURDAY' THEN 6
        END
        - EXTRACT(DOW FROM "starts_on")::INTEGER
        + 7
      ) % 7
    )
  )::DATE;

DO $$
DECLARE
  live_alignment_blocker_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO live_alignment_blocker_count
  FROM "chores" c
  JOIN "chore_templates" t
    ON t."id" = c."template_id"
  WHERE c."template_id" IS NOT NULL
    AND c."slot_dedupe_key" = 'LIVE'
    AND (
      (c."due_date" - t."starts_on") < 0
      OR MOD((c."due_date" - t."starts_on"), t."repeat_every_days") <> 0
    );

  IF live_alignment_blocker_count > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Interval recurrence migration blocked. %s live recurring occurrence(s) no longer align with the current template schedule, so occurrence_index cannot be inferred safely. Inspect recurring template edits and remediate before rerunning Prisma migrate.',
        live_alignment_blocker_count
      );
  END IF;
END $$;

UPDATE "chores" c
SET "occurrence_index" = ((c."due_date" - t."starts_on") / t."repeat_every_days")
FROM "chore_templates" t
WHERE c."template_id" = t."id"
  AND (c."due_date" - t."starts_on") >= 0
  AND MOD((c."due_date" - t."starts_on"), t."repeat_every_days") = 0;

ALTER TABLE "chore_templates"
  ALTER COLUMN "assigned_to_user_id" DROP NOT NULL;

ALTER TABLE "chores"
  DROP CONSTRAINT IF EXISTS "chores_template_id_due_date_slot_key";

DROP INDEX IF EXISTS "chore_templates_group_id_weekday_idx";

ALTER TABLE "chore_templates"
  DROP COLUMN IF EXISTS "weekday";

DO $$
BEGIN
  DROP TYPE "Weekday";
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN dependent_objects_still_exist THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "chore_templates_group_id_assignment_strategy_idx"
  ON "chore_templates"("group_id", "assignment_strategy");
CREATE INDEX IF NOT EXISTS "chore_templates_group_id_status_starts_on_idx"
  ON "chore_templates"("group_id", "status", "starts_on");

CREATE INDEX IF NOT EXISTS "chore_template_participants_group_id_user_id_idx"
  ON "chore_template_participants"("group_id", "user_id");
CREATE INDEX IF NOT EXISTS "chore_template_participants_template_id_idx"
  ON "chore_template_participants"("template_id");

CREATE UNIQUE INDEX IF NOT EXISTS "chore_template_participants_template_id_user_id_key"
  ON "chore_template_participants"("template_id", "user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "chore_template_participants_template_id_sort_order_key"
  ON "chore_template_participants"("template_id", "sort_order");

CREATE INDEX IF NOT EXISTS "chores_template_id_occurrence_index_idx"
  ON "chores"("template_id", "occurrence_index");

DO $$
BEGIN
  ALTER TABLE "chores"
    ADD CONSTRAINT "chores_template_id_occurrence_index_slot_key"
    UNIQUE ("template_id", "occurrence_index", "slot_dedupe_key");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chore_templates"
    ADD CONSTRAINT "chore_templates_repeat_every_days_positive_check"
    CHECK ("repeat_every_days" > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chore_templates"
    ADD CONSTRAINT "chore_templates_assignment_strategy_fixed_assignee_check"
    CHECK (
      ("assignment_strategy" = 'FIXED'::"ChoreTemplateAssignmentStrategy" AND "assigned_to_user_id" IS NOT NULL)
      OR ("assignment_strategy" = 'ROUND_ROBIN'::"ChoreTemplateAssignmentStrategy" AND "assigned_to_user_id" IS NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chores"
    ADD CONSTRAINT "chores_occurrence_index_non_negative_check"
    CHECK ("occurrence_index" IS NULL OR "occurrence_index" >= 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "chores"
  DROP CONSTRAINT IF EXISTS "chores_template_id_fkey";

DO $$
BEGIN
  ALTER TABLE "chores"
    ADD CONSTRAINT "chores_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "chore_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chore_template_participants"
    ADD CONSTRAINT "chore_template_participants_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "chore_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chore_template_participants"
    ADD CONSTRAINT "chore_template_participants_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
