-- AlterTable
ALTER TABLE "join_codes" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "group_audit_logs_target_user_id_idx" ON "group_audit_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "group_audit_logs_created_at_idx" ON "group_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "groups_created_by_idx" ON "groups"("created_by");
