-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "acceptsReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bloodPressure" TEXT,
ADD COLUMN     "bloodType" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "emergencyName" TEXT,
ADD COLUMN     "emergencyPhone" TEXT,
ADD COLUMN     "emergencyRelation" TEXT,
ADD COLUMN     "familyGroup" TEXT,
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "holderRelationship" TEXT,
ADD COLUMN     "holderWorkplace" TEXT,
ADD COLUMN     "insuranceHolder" TEXT,
ADD COLUMN     "insurancePlan" TEXT,
ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "ivaCondition" TEXT,
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "medicalHistory" TEXT,
ADD COLUMN     "province" TEXT,
ADD COLUMN     "referralSource" TEXT,
ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "taxName" TEXT;


-- Backfill nombre / apellido from the existing full name: the last word is
-- the apellido (editable afterwards on the ficha); one word stays as nombre.
UPDATE "Patient"
SET "firstName" = CASE
      WHEN btrim("name") ~ '\s' THEN regexp_replace(btrim("name"), '\s+\S+$', '')
      ELSE btrim("name")
    END,
    "lastName" = CASE
      WHEN btrim("name") ~ '\s' THEN regexp_replace(btrim("name"), '^.*\s+', '')
      ELSE ''
    END;
