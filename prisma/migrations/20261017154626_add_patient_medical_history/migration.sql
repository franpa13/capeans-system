-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "insuranceNumber" TEXT,
ADD COLUMN     "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "medications" TEXT;

