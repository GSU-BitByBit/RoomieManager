-- CreateEnum
CREATE TYPE "ChoreStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ChoreActivityType" AS ENUM ('CREATED', 'ASSIGNED', 'UNASSIGNED', 'COMPLETED', 'REOPENED');

-- CreateTable
CREATE TABLE "chores" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "ChoreStatus" NOT NULL DEFAULT 'PENDING',
    "due_date" TIMESTAMP(3),
    "assigned_to_user_id" TEXT,
    "created_by" TEXT NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chore_activity" (
    "id" TEXT NOT NULL,
    "chore_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "type" "ChoreActivityType" NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chore_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chores_group_id_idx" ON "chores"("group_id");

-- CreateIndex
CREATE INDEX "chores_assigned_to_user_id_idx" ON "chores"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "chores_status_idx" ON "chores"("status");

-- CreateIndex
CREATE INDEX "chores_due_date_idx" ON "chores"("due_date");

-- CreateIndex
CREATE INDEX "chore_activity_chore_id_idx" ON "chore_activity"("chore_id");

-- CreateIndex
CREATE INDEX "chore_activity_group_id_idx" ON "chore_activity"("group_id");

-- CreateIndex
CREATE INDEX "chore_activity_actor_user_id_idx" ON "chore_activity"("actor_user_id");

-- CreateIndex
CREATE INDEX "chore_activity_created_at_idx" ON "chore_activity"("created_at");

-- AddForeignKey
ALTER TABLE "chores" ADD CONSTRAINT "chores_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_activity" ADD CONSTRAINT "chore_activity_chore_id_fkey" FOREIGN KEY ("chore_id") REFERENCES "chores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chore_activity" ADD CONSTRAINT "chore_activity_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
