/**
 * Dev-only seed script. Fills one clinic with realistic patients,
 * consultations and turnos spread across 3 weeks back to 3 weeks ahead —
 * every status, a patientless block, many different patients — so the
 * whole app has something to look at without clicking through every form
 * by hand.
 *
 * Usage:
 *   npm run db:seed                      # only clinic in the DB
 *   CLINIC_ID=<id> npm run db:seed        # pick one, if there's more than one
 *
 * Refuses to run with NODE_ENV=production unless ALLOW_SEED=1 is set —
 * this writes fake patients, don't point it at a real database by accident.
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

const DEFAULT_SUPPLIES = [
  { name: "Gomillas de ortodoncia", unit: "unidad", price: 50, quantity: 300, lowStockAt: 50 },
  { name: "Anestesia", unit: "ampolla", price: 800, quantity: 40, lowStockAt: 10 },
  { name: "Guantes de nitrilo", unit: "caja", price: 4500, quantity: 8, lowStockAt: 3 },
  { name: "Composite (resina)", unit: "ml", price: 1200, quantity: 150, lowStockAt: 30 },
  { name: "Gutapercha", unit: "unidad", price: 300, quantity: 60, lowStockAt: 15 },
];

const DEFAULT_TREATMENTS = [
  { label: "Consulta / diagnóstico", price: 8000 },
  { label: "Limpieza", price: 15000 },
  { label: "Obturación (caries)", price: 20000 },
  { label: "Extracción", price: 25000 },
  { label: "Endodoncia", price: 45000 },
  { label: "Corona / prótesis", price: 60000 },
  { label: "Ortodoncia", price: 35000 },
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
      ...DEFAULT_TREATMENTS.map(({ label, price }, order) => ({
        clinicId,
        category: "treatment",
        label,
        order,
        price,
      })),
    ],
  });
}

async function ensureSupplies(clinicId: string) {
  const existing = await prisma.supply.findFirst({ where: { clinicId } });
  if (existing) return;
  await prisma.supply.createMany({
    data: DEFAULT_SUPPLIES.map((s) => ({ clinicId, ...s })),
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

async function seedConsultations(
  clinicId: string,
  patients: Awaited<ReturnType<typeof seedPatients>>,
  supplies: { id: string; name: string }[],
) {
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
  const supplyId = (name: string) => supplies.find((s) => s.name === name)?.id;

  const rows = [
    { patient: 0, daysAgo: 45, treatment: "Consulta / diagnóstico", teeth: [], notes: "Primera consulta, sin urgencias.", amountCharged: 8000, amountPaid: 8000 },
    { patient: 0, daysAgo: 10, treatment: "Limpieza", teeth: [], amountCharged: 15000, amountPaid: 0 },
    { patient: 1, daysAgo: 30, treatment: "Obturación (caries)", teeth: ["16"], amountCharged: 20000, amountPaid: 20000 },
    { patient: 3, daysAgo: 20, treatment: "Extracción", teeth: ["38"], notes: "Muela del juicio, extracción sin complicaciones.", amountCharged: 25000, amountPaid: 10000 },
    {
      patient: 4,
      daysAgo: 15,
      treatment: "Endodoncia",
      teeth: ["21"],
      amountCharged: 45000,
      amountPaid: 45000,
      supplies: [
        { name: "Anestesia", quantityUsed: 2 },
        { name: "Gutapercha", quantityUsed: 4 },
      ],
    },
    { patient: 4, daysAgo: 60, treatment: "Consulta / diagnóstico", teeth: [] },
    { patient: 6, daysAgo: 5, treatment: "Corona / prótesis", teeth: ["46"], amountCharged: 60000, amountPaid: 0 },
    { patient: 8, daysAgo: 25, treatment: "Limpieza", teeth: [], amountCharged: 15000, amountPaid: 15000 },
    { patient: 8, daysAgo: 3, treatment: "Obturación (caries)", teeth: ["24", "25"], amountCharged: 20000, amountPaid: 8000 },
    {
      patient: 10,
      daysAgo: 12,
      treatment: "Ortodoncia",
      teeth: [],
      notes: "Control mensual de brackets.",
      amountCharged: 35000,
      amountPaid: 35000,
      supplies: [{ name: "Gomillas de ortodoncia", quantityUsed: 12 }],
    },
    { patient: 11, daysAgo: 40, treatment: "Consulta / diagnóstico", teeth: [] },
    { patient: 11, daysAgo: 7, treatment: "Obturación (caries)", teeth: ["36"], amountCharged: 20000, amountPaid: 0 },
  ];

  for (const row of rows) {
    const consultation = await prisma.consultation.create({
      data: {
        clinicId,
        patientId: patients[row.patient].id,
        date: daysAgo(row.daysAgo),
        treatment: row.treatment,
        teeth: row.teeth,
        notes: row.notes ?? null,
        amountCharged: row.amountCharged ?? null,
        amountPaid: row.amountPaid ?? 0,
      },
    });
    // Mirrors recordPayment: what's paid is a dated payment, and amountPaid
    // above equals the payments' sum. Alternating methods give Ingresos a mix.
    if (row.amountPaid) {
      await prisma.payment.create({
        data: {
          clinicId,
          consultationId: consultation.id,
          amount: row.amountPaid,
          method: row.patient % 2 === 0 ? "EFECTIVO" : "TRANSFERENCIA",
          paidAt: consultation.date,
        },
      });
    }
    // Mirrors applySupplyUsages in clinic/data/consultations.ts (duplicated
    // here for the same no-"@/"-imports reason as getWeekStart): every
    // usage row comes with its stock decrement, so seeded stock adds up.
    for (const usage of row.supplies ?? []) {
      const id = supplyId(usage.name);
      if (!id) continue;
      await prisma.supply.update({
        where: { id },
        data: { quantity: { decrement: usage.quantityUsed } },
      });
      await prisma.consultationSupply.create({
        data: { consultationId: consultation.id, supplyId: id, quantityUsed: usage.quantityUsed },
      });
    }
  }
}

type AppointmentRow = {
  startsAt: Date;
  durationMinutes: number;
  patientId?: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
  reason?: string;
};

const DURATIONS = [30, 45, 60] as const;
const REASONS = ["Control", "Limpieza", "Urgencia", "Consulta", "Seguimiento", "Endodoncia"];

// Weekday here is a 0..5 offset from each week's Monday (0=Lun..5=Sáb) —
// Sunday is never scheduled, same as the clinic's own default hours.
// Saturday only opens until 13:00, so it gets a shorter hour pool than
// the rest of the week.
function hourPoolFor(weekday: number): number[] {
  return weekday === 5 ? [9, 10, 11, 12] : [9, 10, 11, 13, 14, 15, 16, 17];
}

/** Generates turnos across several weeks (both past and future), cycling
 * through every patient and mixing all three statuses, so the grid has
 * enough days/people/estados to actually exercise navigation and the
 * estado filter instead of just the current week. Past weeks skew toward
 * CANCELLED/COMPLETED (those turnos already happened), future weeks skew
 * toward CONFIRMED with an occasional early CANCELLED — rows are placed
 * on distinct hours within a day by construction, so none overlap. */
function buildAppointmentRows(weekStart: Date, patients: { id: string }[]): AppointmentRow[] {
  const rows: AppointmentRow[] = [];
  let patientCursor = 0;
  const nextPatientId = () => patients[patientCursor++ % patients.length].id;

  for (let weekOffset = -3; weekOffset <= 3; weekOffset++) {
    for (let weekday = 0; weekday <= 5; weekday++) {
      const dayOffset = weekOffset * 7 + weekday;
      const hourPool = hourPoolFor(weekday);
      // La mayoría de los días tiene 1 turno, uno de cada tres tiene 2.
      const slotsToday = (weekOffset + weekday) % 3 === 0 ? 2 : 1;

      for (let slot = 0; slot < slotsToday; slot++) {
        const hour = hourPool[(weekday * 2 + slot * 3) % hourPool.length];
        const roll = (weekOffset + weekday + slot * 2 + 10) % 5;

        let status: AppointmentRow["status"];
        if (weekOffset < 0) {
          status = roll === 0 ? "CANCELLED" : "COMPLETED";
        } else if (weekOffset === 0) {
          status = roll === 0 ? "CANCELLED" : roll === 1 ? "COMPLETED" : "CONFIRMED";
        } else {
          status = roll === 0 ? "CANCELLED" : "CONFIRMED";
        }

        rows.push({
          startsAt: at(weekStart, dayOffset, hour),
          durationMinutes: DURATIONS[(weekday + slot) % DURATIONS.length],
          patientId: nextPatientId(),
          status,
          reason: REASONS[(weekOffset + weekday + slot + 12) % REASONS.length],
        });
      }
    }
  }

  // Un turno sin paciente asignado, a una hora que ningún slot sistemático
  // usa (la grilla nunca agenda en :30 salvo este), para ejercitar el
  // bloque "Sin paciente" de la grilla.
  rows.push({
    startsAt: at(weekStart, 1, 12, 30),
    durationMinutes: 30,
    status: "CONFIRMED",
    reason: "Bloqueo - reunión",
  });

  return rows;
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Mirrors the real app's own conflict check (findConflict in
 * clinic/data/appointments.ts) — duplicated here rather than imported,
 * same reason as getWeekStart above. Without this, re-running the seed
 * writes straight to the table with prisma.appointment.create and skips
 * the conflict check entirely, so a slot this run picks can land right
 * on top of one an earlier run already placed (different patient, same
 * clinicId, deterministic hour pool) — a genuine double-booking in the
 * data that the app itself would never allow you to create by hand. */
async function hasConflict(
  clinicId: string,
  startsAt: Date,
  durationMinutes: number,
): Promise<boolean> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const dayStart = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
  const candidates = await prisma.appointment.findMany({
    where: { clinicId, status: { not: "CANCELLED" }, startsAt: { gte: dayStart, lt: endsAt } },
  });
  return candidates.some((c) => {
    const cEnd = new Date(c.startsAt.getTime() + c.durationMinutes * 60_000);
    return rangesOverlap(startsAt, endsAt, c.startsAt, cEnd);
  });
}

async function seedAppointments(clinicId: string, patients: Awaited<ReturnType<typeof seedPatients>>) {
  const weekStart = getWeekStart(new Date());
  const rows = buildAppointmentRows(weekStart, patients);

  let created = 0;
  let skipped = 0;
  for (const row of rows) {
    if (row.status !== "CANCELLED" && (await hasConflict(clinicId, row.startsAt, row.durationMinutes))) {
      skipped++;
      continue;
    }
    await prisma.appointment.create({
      data: {
        clinicId,
        patientId: row.patientId ?? null,
        startsAt: row.startsAt,
        durationMinutes: row.durationMinutes,
        status: row.status,
        reason: row.reason ?? null,
      },
    });
    created++;
  }
  if (skipped) console.log(`  (${skipped} turnos omitidos por chocar con uno ya existente)`);
  return created;
}

function assertNotProduction() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    throw new Error(
      "NODE_ENV=production y no se pasó ALLOW_SEED=1 — me niego a sembrar datos de prueba ahí. " +
        "Si estás 100% seguro de que es lo que querés, volvé a correrlo con ALLOW_SEED=1.",
    );
  }
}

async function main() {
  assertNotProduction();

  const clinic = await resolveClinic();
  console.log(`Sembrando datos en "${clinic.name}" (${clinic.id})...`);

  await ensureBusinessHours(clinic.id);
  await ensureClinicOptions(clinic.id);
  await ensureSupplies(clinic.id);
  const supplies = await prisma.supply.findMany({ where: { clinicId: clinic.id } });

  const patients = await seedPatients(clinic.id);
  console.log(`  ${patients.length} pacientes creados`);

  await seedConsultations(clinic.id, patients, supplies);
  console.log(`  consultas creadas`);

  const appointmentCount = await seedAppointments(clinic.id, patients);
  console.log(`  ${appointmentCount} turnos creados (3 semanas atrás a 3 semanas adelante)`);

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
