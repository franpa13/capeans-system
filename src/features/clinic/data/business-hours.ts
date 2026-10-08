import { prisma } from "@/lib/prisma";
import type { BusinessHours } from "@prisma/client";

// JS Date.getDay() convention (see appointments/lib/week.ts): 0=Sunday,
// 1=Monday .. 6=Saturday.
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const DEFAULT_HOURS: Record<
  number,
  { isOpen: boolean; openTime1: string | null; closeTime1: string | null }
> = {
  0: { isOpen: false, openTime1: null, closeTime1: null },
  1: { isOpen: true, openTime1: "09:00", closeTime1: "18:00" },
  2: { isOpen: true, openTime1: "09:00", closeTime1: "18:00" },
  3: { isOpen: true, openTime1: "09:00", closeTime1: "18:00" },
  4: { isOpen: true, openTime1: "09:00", closeTime1: "18:00" },
  5: { isOpen: true, openTime1: "09:00", closeTime1: "18:00" },
  6: { isOpen: true, openTime1: "09:00", closeTime1: "13:00" },
};

export type BusinessHoursInput = {
  isOpen: boolean;
  openTime1: string | null;
  closeTime1: string | null;
  openTime2: string | null;
  closeTime2: string | null;
};

// Backfills only the weekdays this clinic doesn't have a row for yet, not
// an all-or-nothing "has any row at all" check — a clinic seeded before
// Sunday support was added would otherwise never get a Sunday row, and
// the UI's input-level fallback defaults (not these, deliberately
// Sunday-closed ones) would stand in for it looking open instead.
async function seedDefaultBusinessHours(clinicId: string): Promise<void> {
  const existing = await prisma.businessHours.findMany({
    where: { clinicId },
    select: { weekday: true },
  });
  const existingWeekdays = new Set(existing.map((h) => h.weekday));
  const missing = WEEKDAYS.filter((weekday) => !existingWeekdays.has(weekday));
  if (missing.length === 0) return;

  await prisma.businessHours.createMany({
    data: missing.map((weekday) => ({
      clinicId,
      weekday,
      isOpen: DEFAULT_HOURS[weekday].isOpen,
      openTime1: DEFAULT_HOURS[weekday].openTime1,
      closeTime1: DEFAULT_HOURS[weekday].closeTime1,
    })),
  });
}

/** Always returns one row per weekday (all 7), seeding sensible defaults
 * (Sunday closed) on first read so every caller (Configuración, the
 * Turnos grid) sees a complete picture without needing to remember to
 * seed first. */
export async function getBusinessHours(clinicId: string): Promise<BusinessHours[]> {
  await seedDefaultBusinessHours(clinicId);
  return prisma.businessHours.findMany({
    where: { clinicId },
    orderBy: { weekday: "asc" },
  });
}

export async function upsertBusinessHours(
  clinicId: string,
  weekday: number,
  input: BusinessHoursInput,
): Promise<BusinessHours> {
  return prisma.businessHours.upsert({
    where: { clinicId_weekday: { clinicId, weekday } },
    create: { clinicId, weekday, ...input },
    update: { ...input },
  });
}
