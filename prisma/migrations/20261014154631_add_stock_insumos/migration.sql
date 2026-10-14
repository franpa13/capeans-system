-- CreateTable
CREATE TABLE "Supply" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockAt" INTEGER,

    CONSTRAINT "Supply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSupply" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "supplyId" TEXT NOT NULL,
    "quantityUsed" INTEGER NOT NULL,

    CONSTRAINT "ConsultationSupply_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supply_clinicId_idx" ON "Supply"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "Supply_clinicId_name_key" ON "Supply"("clinicId", "name");

-- CreateIndex
CREATE INDEX "ConsultationSupply_consultationId_idx" ON "ConsultationSupply"("consultationId");

-- CreateIndex
CREATE INDEX "ConsultationSupply_supplyId_idx" ON "ConsultationSupply"("supplyId");

-- AddForeignKey
ALTER TABLE "Supply" ADD CONSTRAINT "Supply_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSupply" ADD CONSTRAINT "ConsultationSupply_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSupply" ADD CONSTRAINT "ConsultationSupply_supplyId_fkey" FOREIGN KEY ("supplyId") REFERENCES "Supply"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

