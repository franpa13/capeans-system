-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_clinicId_paidAt_idx" ON "Payment"("clinicId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_consultationId_idx" ON "Payment"("consultationId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: what each consulta already had paid becomes one payment, dated
-- the consulta's day, with method OTRO (it wasn't recorded back then).
INSERT INTO "Payment" ("id", "clinicId", "consultationId", "amount", "method", "paidAt")
SELECT 'bf_' || md5("id"), "clinicId", "id", "amountPaid", 'OTRO', "date"
FROM "Consultation"
WHERE "amountPaid" > 0;
