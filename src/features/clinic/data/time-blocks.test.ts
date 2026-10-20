import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createAppointment,
  updateAppointment,
} from "@/features/clinic/data/appointments";
import {
  createTimeBlock,
  deleteTimeBlock,
  getTimeBlocks,
} from "@/features/clinic/data/time-blocks";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "B" } });
});
afterEach(async () => {
  await prisma.timeBlock.deleteMany({});
  await prisma.appointment.deleteMany({});
  await prisma.clinic.deleteMany({});
});

const at = (day: number, hour: number, minute = 0) => new Date(2026, 1, day, hour, minute);

describe("time blocks", () => {
  it("stores a block and lists the ones overlapping a range", async () => {
    const block = await createTimeBlock(clinicA.id, {
      startsAt: at(2, 0),
      endsAt: at(7, 0),
      reason: "Vacaciones",
    });
    expect(block.block.reason).toBe("Vacaciones");
    await expect(getTimeBlocks(clinicA.id, { from: at(6, 0), to: at(9, 0) })).resolves.toHaveLength(1);
    await expect(getTimeBlocks(clinicA.id, { from: at(7, 0), to: at(9, 0) })).resolves.toHaveLength(0);
    await expect(getTimeBlocks(clinicB.id, { from: at(1, 0), to: at(9, 0) })).resolves.toHaveLength(0);
  });

  it("refuses an end that isn't after the start", async () => {
    await expect(
      createTimeBlock(clinicA.id, { startsAt: at(2, 10), endsAt: at(2, 10) }),
    ).rejects.toThrow("La hora de fin tiene que ser después del inicio");
  });

  it("says how many turnos were already booked inside the new block", async () => {
    await createAppointment(clinicA.id, { startsAt: at(3, 10) });
    const cancelled = await createAppointment(clinicA.id, { startsAt: at(3, 11) });
    await updateAppointment(clinicA.id, cancelled.id, { status: "CANCELLED" });
    const { affectedTurnos } = await createTimeBlock(clinicA.id, { startsAt: at(3, 0), endsAt: at(4, 0) });
    expect(affectedTurnos).toBe(1);
  });

  it("refuses booking or moving a turno into a blocked time", async () => {
    await createTimeBlock(clinicA.id, { startsAt: at(3, 9), endsAt: at(3, 13), reason: "Congreso" });
    await expect(createAppointment(clinicA.id, { startsAt: at(3, 12, 45) })).rejects.toThrow(
      "Ese horario está bloqueado (Congreso)",
    );
    // A turno ending exactly when the block starts is fine.
    const before = await createAppointment(clinicA.id, { startsAt: at(3, 8, 30) });
    await expect(
      updateAppointment(clinicA.id, before.id, { startsAt: at(3, 10) }),
    ).rejects.toThrow("Ese horario está bloqueado (Congreso)");
    // Other clinics aren't affected.
    await expect(createAppointment(clinicB.id, { startsAt: at(3, 10) })).resolves.toBeDefined();
  });

  it("still lets a turno already inside a block be edited, cancelled or marked", async () => {
    const turno = await createAppointment(clinicA.id, { startsAt: at(3, 10) });
    await createTimeBlock(clinicA.id, { startsAt: at(3, 0), endsAt: at(4, 0) });
    await expect(updateAppointment(clinicA.id, turno.id, { notes: "llamar" })).resolves.toBeDefined();
    await expect(updateAppointment(clinicA.id, turno.id, { status: "CANCELLED" })).resolves.toBeDefined();
  });

  it("deletes only the clinic's own block", async () => {
    const { block } = await createTimeBlock(clinicB.id, { startsAt: at(2, 0), endsAt: at(3, 0) });
    await expect(deleteTimeBlock(clinicA.id, block.id)).rejects.toThrow("Block not found for this clinic");
    await deleteTimeBlock(clinicB.id, block.id);
    await expect(getTimeBlocks(clinicB.id, { from: at(1, 0), to: at(9, 0) })).resolves.toHaveLength(0);
  });
});
