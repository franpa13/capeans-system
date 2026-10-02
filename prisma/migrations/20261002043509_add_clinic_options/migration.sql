-- CreateTable
CREATE TABLE "ClinicOption" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ClinicOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClinicOption_clinicId_category_idx" ON "ClinicOption"("clinicId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicOption_clinicId_category_label_key" ON "ClinicOption"("clinicId", "category", "label");

-- AddForeignKey
ALTER TABLE "ClinicOption" ADD CONSTRAINT "ClinicOption_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
