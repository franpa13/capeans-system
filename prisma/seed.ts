/**
 * Dev-only seed script. Fills one clinic with realistic patients,
 * consultations and a week's worth of turnos (spanning every status, a
 * patientless block, next/last week and "today") so the whole app has
 * something to look at without clicking through every form by hand.
 *
 * Usage:
 *   npm run db:seed                      # only clinic in the DB
 *   CLINIC_ID=<id> npm run db:seed        # pick one, if there's more than one
 *
 * Safe to re-run: business hours and clinic options (obra social /
 * tratamiento lists) are only seeded if missing, same as the app does on
 * clinic creation. Patients/consultations/turnos are NOT deduplicated —
 * re-running adds another batch of them.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_INSURANCE_OPTIONS = [
  "OSDE",
  "Swiss Medical",
  "Galeno",
  "Medicus",
  "OMINT",
  "PAMI",
  "IOMA",
  "Sancor Salud",
  "Unión Personal",
  "Prevención Salud",
];

const DEFAULT_TREATMENT_OPTIONS = [
  "Consulta / diagnóstico",
  "Limpieza",
  "Obturación (caries)",
  "Extracción",
  "Endodoncia",
  "Corona / prótesis",
  "Ortodoncia",
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Monday 00:00 (local) of the week containing `date` — mirrors
 * src/features/appointments/lib/week.ts's getWeekStart, duplicated here
 * instead of imported so this script has no "@/..." aliased imports to
 * resolve under tsx. */
function getWeekStart(date: Date): Date {
  const day = startOfDay(date);
  const dayOfWeek = day.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  day.setDate(day.getDate() + diffToMonday);
  return day;
}

function at(weekStart: Date, dayOffset: number, hour: number, minute = 0): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function resolveClinic() {
  const explicitId = process.env.CLINIC_ID;
  if (explicitId) {
    const clinic = await prisma.clinic.findUnique({ where: { id: explicitId } });
    if (!clinic) throw new Error(`No existe ninguna clínica con id ${explicitId}`);
    return clinic;
  }

  const clinics = await prisma.clinic.findMany();
  if (clinics.length === 0) {
    throw new Error(
      "No hay ninguna clínica en la base. Iniciá sesión en la app una vez (creando tu organización) " +
        "para que se genere, y después volvé a correr el seed.",
    );
  }
  if (clinics.length > 1) {
    const list = clinics.map((c) => `  - ${c.name}  (${c.id})`).join("\n");
    throw new Error(
      `Hay más de una clínica en la base, elegí una pasando CLINIC_ID:\n${list}\n\n` +
        `Ej: CLINIC_ID=${clinics[0].id} npm run db:seed`,
    );
  }
  return clinics[0];
}

async function ensureBusinessHours(clinicId: string) {
  for (let weekday = 0; weekday <= 6; weekday++) {
    const exists = await prisma.businessHours.findFirst({ where: { clinicId, weekday } });
    if (exists) continue;
    const isOpen = weekday !== 0; // closed Sunday, same as the app's own default
    await prisma.businessHours.create({
      data: {
        clinicId,
        weekday,
        isOpen,
        openTime1: isOpen ? "09:00" : null,
        closeTime1: isOpen ? (weekday === 6 ? "13:00" : "18:00") : null,
        openTime2: null,
        closeTime2: null,
      },
    });
  }
}

async function ensureClinicOptions(clinicId: string) {
  const existing = await prisma.clinicOption.findFirst({ where: { clinicId } });
  if (existing) return;
  await prisma.clinicOption.createMany({
    data: [
      ...DEFAULT_INSURANCE_OPTIONS.map((label, order) => ({
        clinicId,
        category: "insurance",
        label,
        order,
      })),
      ...DEFAULT_TREATMENT_OPTIONS.map((label, order) => ({
        clinicId,
        category: "treatment",
        label,
        order,
      })),
    ],
  });
}

async function seedPatients(clinicId: string) {
  const rows = [
    {
      name: "María Gómez",
      phone: "11 4455-0001",
      email: "maria.gomez@mail.com",
      dni: "28.456.123",
      birthDate: new Date("1985-03-12"),
      insurance: "OSDE",
      allergies: "Alergia a la penicilina",
    },
    { name: "Carlos Pérez", phone: "11 4455-0002", insurance: "Swiss Medical" },
    { name: "Lucía Fernández", phone: "11 4455-0003" },
    {
      name: "Jorge Álvarez",
      phone: "11 4455-0004",
      dni: "25.123.456",
      insurance: "Galeno",
      address: "Av. Rivadavia 1234, CABA",
    },
    {
      name: "Sofía Martínez",
      phone: "11 4455-0005",
      birthDate: new Date("1950-07-20"),
      insurance: "PAMI",
      allergies: "Alergia a la aspirina",
    },
    { name: "Diego Romero", phone: "11 4455-0006" },
    {
      name: "Valentina López",
      phone: "11 4455-0007",
      insurance: "OMINT",
      address: "Calle Falsa 123, San Isidro",
    },
    { name: "Martín Sánchez", phone: "11 4455-0008", insurance: "Particular (sin obra social)" },
    { name: "Camila Torres", phone: "11 4455-0009", dni: "30.987.654", insurance: "Medicus" },
    { name: "Nicolás Díaz", phone: "11 4455-0010" },
    { name: "Julieta Ríos", phone: "11 4455-0011", insurance: "Obra social del gremio textil" },
    {
      name: "Pablo Herrera",
      phone: "11 4455-0012",
      insurance: "Sancor Salud",
      allergies: "Alergia al látex",
    },
  ];

  const patients = [];
  for (const row of rows) {
    patients.push(
      await prisma.patient.create({
        data: {
          clinicId,
          name: row.name,
          phone: row.phone,
          email: row.email ?? null,
          dni: row.dni ?? null,
          birthDate: row.birthDate ?? null,
          address: row.address ?? null,
          insurance: row.insurance ?? null,
          allergies: row.allergies ?? null,
        },
      }),
    );
  }
  return patients;
}

async function seedConsultations(clinicId: string, patients: Awaited<ReturnType<typeof seedPatients>>) {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const rows = [
    { patient: 0, daysAgo: 45, treatment: "Consulta / diagnóstico", teeth: [], notes: "Primera consulta, sin urgencias." },
    { patient: 0, daysAgo: 10, treatment: "Limpieza", teeth: [] },
    { patient: 1, daysAgo: 30, treatment: "Obturación (caries)", teeth: ["16"] },
    { patient: 3, daysAgo: 20, treatment: "Extracción", teeth: ["38"], notes: "Muela del juicio, extracción sin complicaciones." },
    { patient: 4, daysAgo: 15, treatment: "Endodoncia", teeth: ["21"] },
    { patient: 4, daysAgo: 60, treatment: "Consulta / diagnóstico", teeth: [] },
    { patient: 6, daysAgo: 5, treatment: "Corona / prótesis", teeth: ["46"] },
    { patient: 8, daysAgo: 25, treatment: "Limpieza", teeth: [] },
    { patient: 8, daysAgo: 3, treatment: "Obturación (caries)", teeth: ["24", "25"] },
    { patient: 10, daysAgo: 12, treatment: "Ortodoncia", teeth: [], notes: "Control mensual de brackets." },
    { patient: 11, daysAgo: 40, treatment: "Consulta / diagnóstico", teeth: [] },
    { patient: 11, daysAgo: 7, treatment: "Obturación (caries)", teeth: ["36"] },
  ];

  for (const row of rows) {
    await prisma.consultation.create({
      data: {
        clinicId,
        patientId: patients[row.patient].id,
        date: daysAgo(row.daysAgo),
        treatment: row.treatment,
        teeth: row.teeth,
        notes: row.notes ?? null,
      },
    });
  }
}

async function seedAppointments(clinicId: string, patients: Awaited<ReturnType<typeof seedPatients>>) {
  const weekStart = getWeekStart(new Date());
  const p = (i: number) => patients[i].id;

  const rows: {
    startsAt: Date;
    durationMinutes: number;
    patientId?: string;
    status?: "CONFIRMED" | "CANCELLED" | "COMPLETED";
    reason?: string;
  }[] = [
    { startsAt: at(weekStart, 0, 9), durationMinutes: 30, patientId: p(0), reason: "Control" },
    { startsAt: at(weekStart, 0, 10, 30), durationMinutes: 45, patientId: p(1), reason: "Limpieza" },
    { startsAt: at(weekStart, 0, 14), durationMinutes: 30, patientId: p(2), status: "CANCELLED", reason: "Urgencia" },
    { startsAt: at(weekStart, 1, 9), durationMinutes: 60, patientId: p(3), reason: "Endodoncia" },
    { startsAt: at(weekStart, 1, 11), durationMinutes: 30, patientId: p(4), status: "COMPLETED", reason: "Consulta" },
    { startsAt: at(weekStart, 1, 16), durationMinutes: 30, reason: "Bloqueo - reunión" }, // sin paciente
    { startsAt: at(weekStart, 2, 9, 30), durationMinutes: 30, patientId: p(5) },
    { startsAt: at(weekStart, 2, 15), durationMinutes: 30, patientId: p(0), reason: "Seguimiento" },
    { startsAt: at(weekStart, 3, 9), durationMinutes: 45, patientId: p(6) },
    { startsAt: at(weekStart, 4, 10), durationMinutes: 30, patientId: p(7) },
    { startsAt: at(weekStart, 4, 13), durationMinutes: 60, patientId: p(8), reason: "Corona" },
    { startsAt: at(weekStart, 5, 9), durationMinutes: 30, patientId: p(9) },
    // Próxima semana, para probar la flecha de avanzar.
    { startsAt: at(weekStart, 7, 9), durationMinutes: 30, patientId: p(1) },
    // Semana pasada, ya completado, para probar la flecha de retroceder
    // y el filtro de "Turnos completados".
    { startsAt: at(weekStart, -4, 11), durationMinutes: 30, patientId: p(2), status: "COMPLETED" },
  ];

  // Garantiza al menos un turno "hoy" sin importar qué día se corra el
  // seed, para que la vista Diario nunca abra vacía por default.
  const todayOffset = Math.round(
    (startOfDay(new Date()).getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000),
  );
  const freeHourByOffset: Record<number, number> = { 0: 17, 1: 13, 2: 11, 3: 13, 4: 16, 5: 11 };
  if (todayOffset in freeHourByOffset) {
    rows.push({
      startsAt: at(weekStart, todayOffset, freeHourByOffset[todayOffset]),
      durationMinutes: 30,
      patientId: p(10),
      reason: "Turno de hoy",
    });
  }

  for (const row of rows) {
    await prisma.appointment.create({
      data: {
        clinicId,
        patientId: row.patientId ?? null,
        startsAt: row.startsAt,
        durationMinutes: row.durationMinutes,
        status: row.status ?? "CONFIRMED",
        reason: row.reason ?? null,
      },
    });
  }
}

async function main() {
  const clinic = await resolveClinic();
  console.log(`Sembrando datos en "${clinic.name}" (${clinic.id})...`);

  await ensureBusinessHours(clinic.id);
  await ensureClinicOptions(clinic.id);

  const patients = await seedPatients(clinic.id);
  console.log(`  ${patients.length} pacientes creados`);

  await seedConsultations(clinic.id, patients);
  console.log(`  consultas creadas`);

  await seedAppointments(clinic.id, patients);
  console.log(`  turnos creados (semana actual + semana pasada/próxima)`);

  console.log("Listo.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
