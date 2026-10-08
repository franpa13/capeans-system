import { prisma } from "@/lib/prisma";
import type { BusinessHours } from "@prisma/client";

// JS Date.getDay() convention (see appointments/lib/week.ts): 1=Monday ..
// 6=Saturday. Sunday (0) is deliberately excluded — the weekly calendar
// never shows a Sunday column, so there's nothing to configure for it.
const WEEKDAYS = [1, 2, 3, 4, 5, 6] as const;

const DEFAULT_HOURS: Record<number, { openTime1: string; closeTime1: string }> = {
  1: { openTime1: "09:00", closeTime1: "18:00" },
  2: { openTime1: "09:00", closeTime1: "18:00" },
  3: { openTime1: "09:00", closeTime1: "18:00" },
  4: { openTime1: "09:00", closeTime1: "18:00" },
  5: { openTime1: "09:00", closeTime1: "18:00" },
  6: { openTime1: "09:00", closeTime1: "13:00" },
};

export type BusinessHoursInput = {
  isOpen: boolean;
  openTime1: string | null;
  closeTime1: string | null;
  openTime2: string | null;
  closeTime2: string | null;
};

async function seedDefaultBusinessHours(clinicId: string): Promise<void> {
  const existing = await prisma.businessHours.findFirst({ where: { clinicId } });
  if (existing) return;

  await prisma.businessHours.createMany({
    data: WEEKDAYS.map((weekday) => ({
      clinicId,
      weekday,
      isOpen: true,
      openTime1: DEFAULT_HOURS[weekday].openTime1,
      closeTime1: DEFAULT_HOURS[weekday].closeTime1,
    })),
  });
}

/** Always returns one row per weekday (Monday..Saturday), seeding sensible
 * defaults on first read so every caller (Configuración, the Turnos grid)
 * sees a complete picture without needing to remember to seed first. */
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
