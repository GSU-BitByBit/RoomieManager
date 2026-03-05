-- Create enums
CREATE TYPE "BillSplitMethod" AS ENUM ('EQUAL', 'CUSTOM');
CREATE TYPE "LedgerEntryType" AS ENUM ('BILL_SPLIT', 'PAYMENT');

-- Create bills table
CREATE TABLE "bills" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "paid_by_user_id" TEXT NOT NULL,
  "split_method" "BillSplitMethod" NOT NULL DEFAULT 'CUSTOM',
  "created_by" TEXT NOT NULL,
  "incurred_at" TIMESTAMP(3) NOT NULL,
  "due_date" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- Create bill_splits table
CREATE TABLE "bill_splits" (
  "id" TEXT NOT NULL,
  "bill_id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bill_splits_pkey" PRIMARY KEY ("id")
);

-- Create payments table
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "bill_id" TEXT,
  "payer_user_id" TEXT NOT NULL,
  "payee_user_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "note" TEXT,
  "idempotency_key" VARCHAR(64),
  "paid_at" TIMESTAMP(3) NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- Create ledger_entries table
CREATE TABLE "ledger_entries" (
  "id" TEXT NOT NULL,
  "group_id" TEXT NOT NULL,
  "bill_id" TEXT,
  "bill_split_id" TEXT,
  "payment_id" TEXT,
  "entry_type" "LedgerEntryType" NOT NULL,
  "from_user_id" TEXT NOT NULL,
  "to_user_id" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "bill_splits_bill_id_user_id_key" ON "bill_splits"("bill_id", "user_id");
CREATE UNIQUE INDEX "payments_group_id_idempotency_key_key" ON "payments"("group_id", "idempotency_key");

-- Query indexes
CREATE INDEX "bills_group_id_idx" ON "bills"("group_id");
CREATE INDEX "bills_paid_by_user_id_idx" ON "bills"("paid_by_user_id");
CREATE INDEX "bills_created_at_idx" ON "bills"("created_at");

CREATE INDEX "bill_splits_group_id_idx" ON "bill_splits"("group_id");
CREATE INDEX "bill_splits_user_id_idx" ON "bill_splits"("user_id");

CREATE INDEX "payments_group_id_idx" ON "payments"("group_id");
CREATE INDEX "payments_bill_id_idx" ON "payments"("bill_id");
CREATE INDEX "payments_payer_user_id_idx" ON "payments"("payer_user_id");
CREATE INDEX "payments_payee_user_id_idx" ON "payments"("payee_user_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");

CREATE INDEX "ledger_entries_group_id_idx" ON "ledger_entries"("group_id");
CREATE INDEX "ledger_entries_bill_id_idx" ON "ledger_entries"("bill_id");
CREATE INDEX "ledger_entries_payment_id_idx" ON "ledger_entries"("payment_id");
CREATE INDEX "ledger_entries_from_user_id_idx" ON "ledger_entries"("from_user_id");
CREATE INDEX "ledger_entries_to_user_id_idx" ON "ledger_entries"("to_user_id");
CREATE INDEX "ledger_entries_currency_idx" ON "ledger_entries"("currency");
CREATE INDEX "ledger_entries_occurred_at_idx" ON "ledger_entries"("occurred_at");

-- Foreign keys
ALTER TABLE "bills"
  ADD CONSTRAINT "bills_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bill_splits"
  ADD CONSTRAINT "bill_splits_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bill_splits"
  ADD CONSTRAINT "bill_splits_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "groups"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_bill_id_fkey"
  FOREIGN KEY ("bill_id") REFERENCES "bills"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_bill_split_id_fkey"
  FOREIGN KEY ("bill_split_id") REFERENCES "bill_splits"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
