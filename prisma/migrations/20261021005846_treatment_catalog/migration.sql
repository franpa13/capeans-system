-- AlterTable
ALTER TABLE "ClinicOption" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cashPrice" INTEGER,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "specialty" TEXT;


-- Default especialidades for every existing clinic (new clinics get them
-- from seedDefaultClinicOptions).
INSERT INTO "ClinicOption" ("id", "clinicId", "category", "label", "order")
SELECT 'sp_' || md5(c."id" || s.label), c."id", 'specialty', s.label, s.ord
FROM "Clinic" c
CROSS JOIN (VALUES
  ('Odontología general', 0),
  ('Odontología preventiva', 1),
  ('Operatoria dental', 2),
  ('Endodoncia', 3),
  ('Periodoncia', 4),
  ('Ortodoncia', 5),
  ('Odontopediatría', 6),
  ('Prótesis', 7),
  ('Implantología', 8),
  ('Cirugía bucomaxilofacial', 9),
  ('Estética dental', 10),
  ('Diagnóstico por imágenes', 11)
) AS s(label, ord)
ON CONFLICT ("clinicId", "category", "label") DO NOTHING;

-- The default tratamientos start with their natural especialidad.
UPDATE "ClinicOption" t SET "specialty" = m.specialty
FROM (VALUES
  ('Consulta / diagnóstico', 'Odontología general'),
  ('Limpieza', 'Odontología preventiva'),
  ('Obturación (caries)', 'Operatoria dental'),
  ('Extracción', 'Cirugía bucomaxilofacial'),
  ('Endodoncia', 'Endodoncia'),
  ('Corona / prótesis', 'Prótesis'),
  ('Ortodoncia', 'Ortodoncia')
) AS m(label, specialty)
WHERE t."category" = 'treatment' AND t."label" = m.label AND t."specialty" IS NULL;
