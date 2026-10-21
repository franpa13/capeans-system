-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "professionalId" TEXT;

-- AlterTable
ALTER TABLE "ClinicMember" ADD COLUMN     "professionalId" TEXT;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "professionalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMember_professionalId_key" ON "ClinicMember"("professionalId");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMember" ADD CONSTRAINT "ClinicMember_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

