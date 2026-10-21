-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('PENDING', 'DONE');

-- CreateTable
CREATE TABLE "ToothFinding" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "tooth" TEXT NOT NULL,
    "surface" TEXT,
    "condition" TEXT NOT NULL,
    "status" "FindingStatus" NOT NULL,
    "notes" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "consultationId" TEXT,

    CONSTRAINT "ToothFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ToothFinding_clinicId_patientId_idx" ON "ToothFinding"("clinicId", "patientId");

-- AddForeignKey
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothFinding" ADD CONSTRAINT "ToothFinding_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

