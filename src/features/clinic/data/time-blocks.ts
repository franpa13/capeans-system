import { prisma } from "@/lib/prisma";
import type { Prisma, TimeBlock } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export type NewTimeBlockInput = { startsAt: Date; endsAt: Date; reason?: string };

/** Blocks a period. Turnos already booked inside it stay (the dentist
 * decides what to do with them) — `affectedTurnos` says how many there
 * are, so the UI can point it out. */
export async function createTimeBlock(
  clinicId: string,
  input: NewTimeBlockInput,
): Promise<{ block: TimeBlock; affectedTurnos: number }> {
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    throw new Error("La hora de fin tiene que ser después del inicio");
  }
  const block = await prisma.timeBlock.create({
    data: {
      clinicId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      reason: input.reason?.trim() || null,
    },
  });
  const affectedTurnos = await prisma.appointment.count({
    where: {
      clinicId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { gte: input.startsAt, lt: input.endsAt },
    },
  });
  return { block, affectedTurnos };
}

/** Blocks overlapping [from, to) — what the agenda draws. */
export async function getTimeBlocks(
  clinicId: string,
  range: { from: Date; to: Date },
): Promise<TimeBlock[]> {
  return prisma.timeBlock.findMany({
    where: { clinicId, startsAt: { lt: range.to }, endsAt: { gt: range.from } },
    orderBy: { startsAt: "asc" },
  });
}

export async function deleteTimeBlock(clinicId: string, id: string): Promise<void> {
  const result = await prisma.timeBlock.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Block not found for this clinic");
}

/** Refuses a turno at [startsAt, startsAt + duration) that overlaps a block. */
export async function assertNotBlocked(
  db: Db,
  clinicId: string,
  startsAt: Date,
  durationMinutes: number,
): Promise<void> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const block = await db.timeBlock.findFirst({
    where: { clinicId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  if (block) {
    throw new Error(
      block.reason ? `Ese horario está bloqueado (${block.reason})` : "Ese horario está bloqueado",
    );
  }
}
