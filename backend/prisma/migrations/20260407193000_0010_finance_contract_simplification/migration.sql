-- Finance contract simplification:
-- The backend only supports explicit custom split rows. Remove the unused EQUAL enum value.

UPDATE "bills"
SET "split_method" = 'CUSTOM'
WHERE "split_method" = 'EQUAL';

ALTER TYPE "BillSplitMethod" RENAME TO "BillSplitMethod_old";

CREATE TYPE "BillSplitMethod" AS ENUM ('CUSTOM');

ALTER TABLE "bills"
ALTER COLUMN "split_method" DROP DEFAULT,
ALTER COLUMN "split_method" TYPE "BillSplitMethod"
USING ("split_method"::text::"BillSplitMethod"),
ALTER COLUMN "split_method" SET DEFAULT 'CUSTOM';

DROP TYPE "BillSplitMethod_old";
