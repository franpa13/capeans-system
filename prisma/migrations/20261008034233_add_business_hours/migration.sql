-- CreateTable
CREATE TABLE "BusinessHours" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "openTime1" TEXT,
    "closeTime1" TEXT,
    "openTime2" TEXT,
    "closeTime2" TEXT,

    CONSTRAINT "BusinessHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessHours_clinicId_idx" ON "BusinessHours"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessHours_clinicId_weekday_key" ON "BusinessHours"("clinicId", "weekday");

-- AddForeignKey
ALTER TABLE "BusinessHours" ADD CONSTRAINT "BusinessHours_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
