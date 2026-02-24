-- Create enums
CREATE TYPE "GroupMemberRole" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "GroupMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- Create groups table
CREATE TABLE "groups" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- Create group_members table
CREATE TABLE "group_members" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" "GroupMemberRole" NOT NULL DEFAULT 'MEMBER',
  "status" "GroupMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- Create join_codes table
CREATE TABLE "join_codes" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "code" VARCHAR(20) NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "join_codes_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");
CREATE UNIQUE INDEX "join_codes_group_id_key" ON "join_codes"("group_id");
CREATE UNIQUE INDEX "join_codes_code_key" ON "join_codes"("code");

-- Query indexes
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");
CREATE INDEX "group_members_group_id_idx" ON "group_members"("group_id");

-- Foreign keys
ALTER TABLE "group_members"
  ADD CONSTRAINT "group_members_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "join_codes"
  ADD CONSTRAINT "join_codes_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
