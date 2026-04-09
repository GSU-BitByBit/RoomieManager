-- Module 9 chore redesign rollout
--
-- This migration upgrades the legacy claim-based chores table into the
-- assigned-based occurrence model and introduces recurring chore templates.
--
-- Safety rules:
-- - Existing chores are preserved as one-off occurrences (`template_id` stays NULL).
-- - No recurring templates are inferred from legacy chores.
-- - `due_date` is converted from TIMESTAMP to DATE by preserving the stored
--   calendar day (`due_date::date`). No timezone reinterpretation is applied.
-- - `completed_by_user_id` is backfilled from the most recent COMPLETED
--   activity actor when available.
-- - The migration aborts if legacy rows would violate the new domain
--   invariants. Operators must run `pnpm chores:redesign:audit` and fix those
--   rows manually before re-running Prisma migrate.

-- Expand status/activity enums for the redesigned domain.
ALTER TYPE "ChoreStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "ChoreActivityType" ADD VALUE IF NOT EXISTS 'CANCELLED';

DO $$
BEGIN
  CREATE TYPE "ChoreTemplateStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "Weekday" AS ENUM (
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
    'SUNDAY'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "chore_templates" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "status" "ChoreTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
  "weekday" "Weekday" NOT NULL,
  "starts_on" DATE NOT NULL,
  "ends_on" DATE,
  "assigned_to_user_id" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "updated_by" TEXT,
  "generated_through_on" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chore_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "chores"
  ADD COLUMN IF NOT EXISTS "template_id" TEXT,
  ADD COLUMN IF NOT EXISTS "slot_dedupe_key" VARCHAR(16),
  ADD COLUMN IF NOT EXISTS "completed_by_user_id" TEXT;

WITH latest_completed_activity AS (
  SELECT DISTINCT ON ("chore_id")
    "chore_id",
    "actor_user_id"
  FROM "chore_activity"
  WHERE "type" = 'COMPLETED'
  ORDER BY "chore_id", "created_at" DESC, "id" DESC
)
UPDATE "chores" c
SET "completed_by_user_id" = lca."actor_user_id"
FROM latest_completed_activity lca
WHERE c."id" = lca."chore_id"
  AND c."completed_at" IS NOT NULL
  AND c."completed_by_user_id" IS NULL;

DO $$
DECLARE
  missing_assignee_count BIGINT;
  missing_due_date_count BIGINT;
  assignee_not_group_member_count BIGINT;
  pending_assignee_inactive_count BIGINT;
  completed_missing_completed_at_count BIGINT;
  pending_has_completed_at_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO missing_assignee_count
  FROM "chores"
  WHERE "assigned_to_user_id" IS NULL;

  SELECT COUNT(*)
  INTO missing_due_date_count
  FROM "chores"
  WHERE "due_date" IS NULL;

  SELECT COUNT(*)
  INTO assignee_not_group_member_count
  FROM "chores" c
  LEFT JOIN "group_members" gm
    ON gm."group_id" = c."group_id"
   AND gm."user_id" = c."assigned_to_user_id"
  WHERE c."assigned_to_user_id" IS NOT NULL
    AND gm."id" IS NULL;

  SELECT COUNT(*)
  INTO pending_assignee_inactive_count
  FROM "chores" c
  JOIN "group_members" gm
    ON gm."group_id" = c."group_id"
   AND gm."user_id" = c."assigned_to_user_id"
  WHERE c."assigned_to_user_id" IS NOT NULL
    AND c."status" = 'PENDING'::"ChoreStatus"
    AND gm."status" <> 'ACTIVE'::"GroupMemberStatus";

  SELECT COUNT(*)
  INTO completed_missing_completed_at_count
  FROM "chores"
  WHERE "status" = 'COMPLETED'::"ChoreStatus"
    AND "completed_at" IS NULL;

  SELECT COUNT(*)
  INTO pending_has_completed_at_count
  FROM "chores"
  WHERE "status" = 'PENDING'::"ChoreStatus"
    AND "completed_at" IS NOT NULL;

  IF missing_assignee_count > 0
    OR missing_due_date_count > 0
    OR assignee_not_group_member_count > 0
    OR pending_assignee_inactive_count > 0
    OR completed_missing_completed_at_count > 0
    OR pending_has_completed_at_count > 0
  THEN
    RAISE EXCEPTION USING
      MESSAGE = format(
        'Chore redesign migration blocked. Resolve legacy chores first (missing assignee: %s, missing due date: %s, assignee not in group: %s, pending chores assigned to inactive members: %s, completed chores missing completed_at: %s, pending chores with completed_at: %s). Run `pnpm chores:redesign:audit` for details before rerunning Prisma migrate.',
        missing_assignee_count,
        missing_due_date_count,
        assignee_not_group_member_count,
        pending_assignee_inactive_count,
        completed_missing_completed_at_count,
        pending_has_completed_at_count
      );
  END IF;
END $$;

ALTER TABLE "chores"
  ALTER COLUMN "due_date" TYPE DATE USING ("due_date"::date);

ALTER TABLE "chores"
  ALTER COLUMN "due_date" SET NOT NULL,
  ALTER COLUMN "assigned_to_user_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "chore_templates_group_id_idx"
  ON "chore_templates"("group_id");
CREATE INDEX IF NOT EXISTS "chore_templates_group_id_status_idx"
  ON "chore_templates"("group_id", "status");
CREATE INDEX IF NOT EXISTS "chore_templates_group_id_assigned_to_user_id_idx"
  ON "chore_templates"("group_id", "assigned_to_user_id");
CREATE INDEX IF NOT EXISTS "chore_templates_group_id_status_generated_through_on_idx"
  ON "chore_templates"("group_id", "status", "generated_through_on");
CREATE INDEX IF NOT EXISTS "chore_templates_group_id_weekday_idx"
  ON "chore_templates"("group_id", "weekday");
CREATE INDEX IF NOT EXISTS "chore_templates_group_id_created_at_idx"
  ON "chore_templates"("group_id", "created_at");

CREATE INDEX IF NOT EXISTS "chores_template_id_due_date_idx"
  ON "chores"("template_id", "due_date");
CREATE INDEX IF NOT EXISTS "chores_group_id_due_date_idx"
  ON "chores"("group_id", "due_date");
CREATE INDEX IF NOT EXISTS "chores_group_id_status_due_date_idx"
  ON "chores"("group_id", "status", "due_date");
CREATE INDEX IF NOT EXISTS "chores_group_id_assigned_to_user_id_due_date_idx"
  ON "chores"("group_id", "assigned_to_user_id", "due_date");
CREATE INDEX IF NOT EXISTS "chores_group_id_created_at_idx"
  ON "chores"("group_id", "created_at");

DROP INDEX IF EXISTS "chores_assigned_to_user_id_idx";
DROP INDEX IF EXISTS "chores_status_idx";
DROP INDEX IF EXISTS "chores_due_date_idx";
DROP INDEX IF EXISTS "chores_group_id_idx";

DO $$
BEGIN
  ALTER TABLE "chore_templates"
    ADD CONSTRAINT "chore_templates_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chores"
    ADD CONSTRAINT "chores_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "chore_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "chores"
    ADD CONSTRAINT "chores_template_id_due_date_slot_key"
    UNIQUE ("template_id", "due_date", "slot_dedupe_key");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
