-- CreateTable
CREATE TABLE "PatientNote" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientNote_clinicId_patientId_idx" ON "PatientNote"("clinicId", "patientId");

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The single "Notas internas" field becomes the patient's first observación.
INSERT INTO "PatientNote" ("id", "clinicId", "patientId", "text", "authorName", "createdAt")
SELECT 'pn_' || md5("id"), "clinicId", "id", btrim("internalNotes"), NULL, CURRENT_TIMESTAMP
FROM "Patient"
WHERE "internalNotes" IS NOT NULL AND btrim("internalNotes") <> '';

UPDATE "Patient" SET "internalNotes" = NULL WHERE "internalNotes" IS NOT NULL;
