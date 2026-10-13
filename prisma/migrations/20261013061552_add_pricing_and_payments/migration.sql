-- AlterTable
ALTER TABLE "ClinicOption" ADD COLUMN     "price" INTEGER;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "amountCharged" INTEGER,
ADD COLUMN     "amountPaid" INTEGER NOT NULL DEFAULT 0;
