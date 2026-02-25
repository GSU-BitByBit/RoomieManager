-- CreateTable
CREATE TABLE "group_audit_logs" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "target_user_id" TEXT,
    "action" VARCHAR(64) NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "group_audit_logs_group_id_idx" ON "group_audit_logs"("group_id");

-- CreateIndex
CREATE INDEX "group_audit_logs_actor_user_id_idx" ON "group_audit_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "group_audit_logs" ADD CONSTRAINT "group_audit_logs_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
