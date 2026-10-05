-- AlterTable: add the new array column, backfill it from the old single
-- "tooth" column, then drop that column. Keeps existing per-tooth data
-- instead of discarding it.
ALTER TABLE "Consultation" ADD COLUMN "teeth" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Consultation"
SET "teeth" = ARRAY["tooth"]
WHERE "tooth" IS NOT NULL;

ALTER TABLE "Consultation" DROP COLUMN "tooth";
