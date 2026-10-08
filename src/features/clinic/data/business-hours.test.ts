import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBusinessHours, upsertBusinessHours } from "@/features/clinic/data/business-hours";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({
    data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" },
  });
  clinicB = await prisma.clinic.create({
    data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" },
  });
});

afterEach(async () => {
  await prisma.businessHours.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("business hours data layer", () => {
  it("seeds sensible defaults for all 7 weekdays the first time it's read, Sunday closed", async () => {
    const hours = await getBusinessHours(clinicA.id);
    const weekdays = hours.map((h) => h.weekday).sort((a, b) => a - b);
    expect(weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const sunday = hours.find((h) => h.weekday === 0);
    expect(sunday?.isOpen).toBe(false);
    expect(hours.filter((h) => h.weekday !== 0).every((h) => h.isOpen)).toBe(true);
  });

  it("backfills only the missing weekdays for a clinic seeded before Sunday was added, leaving its existing rows untouched", async () => {
    // Simulates a clinic seeded under the old Monday..Saturday-only
    // seeding, bypassing getBusinessHours so no Sunday row exists yet.
    await prisma.businessHours.createMany({
      data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
        clinicId: clinicA.id,
        weekday,
        isOpen: weekday !== 3,
        openTime1: weekday === 3 ? null : "10:00",
        closeTime1: weekday === 3 ? null : "17:00",
      })),
    });

    const hours = await getBusinessHours(clinicA.id);
    const weekdays = hours.map((h) => h.weekday).sort((a, b) => a - b);
    expect(weekdays).toEqual([0, 1, 2, 3, 4, 5, 6]);

    const sunday = hours.find((h) => h.weekday === 0);
    expect(sunday?.isOpen).toBe(false);

    // The custom Wednesday-closed value from "before" must survive the
    // backfill, not get reset to the Wednesday default (open).
    const wednesday = hours.find((h) => h.weekday === 3);
    expect(wednesday?.isOpen).toBe(false);
    const monday = hours.find((h) => h.weekday === 1);
    expect(monday?.openTime1).toBe("10:00");
  });

  it("does not reseed a clinic that already has hours configured", async () => {
    await getBusinessHours(clinicA.id); // triggers the seed
    await upsertBusinessHours(clinicA.id, 1, {
      isOpen: false,
      openTime1: null,
      closeTime1: null,
      openTime2: null,
      closeTime2: null,
    });

    const hours = await getBusinessHours(clinicA.id);
    const monday = hours.find((h) => h.weekday === 1);
    expect(monday?.isOpen).toBe(false);
  });

  it("does not return a clinic A row when queried with clinic B's id", async () => {
    await getBusinessHours(clinicA.id);
    const hoursB = await getBusinessHours(clinicB.id);
    expect(hoursB.every((h) => h.clinicId === clinicB.id)).toBe(true);
  });

  it("upserts a day's hours, including an optional second shift", async () => {
    await getBusinessHours(clinicA.id);
    const updated = await upsertBusinessHours(clinicA.id, 3, {
      isOpen: true,
      openTime1: "09:00",
      closeTime1: "13:00",
      openTime2: "15:00",
      closeTime2: "19:00",
    });

    expect(updated.openTime1).toBe("09:00");
    expect(updated.closeTime1).toBe("13:00");
    expect(updated.openTime2).toBe("15:00");
    expect(updated.closeTime2).toBe("19:00");
  });

  it("refuses to let one clinic's upsert touch another clinic's row for the same weekday", async () => {
    await getBusinessHours(clinicA.id);
    await getBusinessHours(clinicB.id);

    await upsertBusinessHours(clinicA.id, 2, {
      isOpen: false,
      openTime1: null,
      closeTime1: null,
      openTime2: null,
      closeTime2: null,
    });

    const hoursB = await getBusinessHours(clinicB.id);
    const tuesdayB = hoursB.find((h) => h.weekday === 2);
    expect(tuesdayB?.isOpen).toBe(true);
  });
});
