-- AlterTable
ALTER TABLE "ClinicOption" ADD COLUMN     "commissionPercent" INTEGER;

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "commissionPercent" INTEGER;

-- CreateTable
CREATE TABLE "Liquidation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "professionalId" TEXT,
    "professionalName" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "periodFrom" TIMESTAMP(3) NOT NULL,
    "periodTo" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "totalCollected" INTEGER NOT NULL,
    "totalCommission" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Liquidation_clinicId_professionalId_idx" ON "Liquidation"("clinicId", "professionalId");

-- CreateIndex
CREATE UNIQUE INDEX "Liquidation_clinicId_number_key" ON "Liquidation"("clinicId", "number");

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Liquidation" ADD CONSTRAINT "Liquidation_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

