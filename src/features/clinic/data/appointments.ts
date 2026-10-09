import { prisma } from "@/lib/prisma";
import type { Appointment, AppointmentStatus, Prisma } from "@prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export type NewAppointmentInput = {
  patientId?: string;
  startsAt: Date;
  durationMinutes?: number;
  reason?: string;
  status?: AppointmentStatus;
  notes?: string;
};

export type UpdateAppointmentInput = Partial<NewAppointmentInput>;

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

async function findConflict(
  db: Db,
  clinicId: string,
  startsAt: Date,
  durationMinutes: number,
  excludeId?: string,
): Promise<Appointment | null> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const candidates = await db.appointment.findMany({
    where: {
      clinicId,
      status: { not: "CANCELLED" },
      startsAt: { lt: endsAt },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });

  return (
    candidates.find((candidate) => {
      const candidateEndsAt = new Date(
        candidate.startsAt.getTime() + candidate.durationMinutes * 60_000,
      );
      return overlaps(startsAt, endsAt, candidate.startsAt, candidateEndsAt);
    }) ?? null
  );
}

export async function getAppointments(
  clinicId: string,
  range?: { from: Date; to: Date },
  status?: AppointmentStatus,
): Promise<Appointment[]> {
  return prisma.appointment.findMany({
    where: {
      clinicId,
      ...(range ? { startsAt: { gte: range.from, lt: range.to } } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function getAppointment(
  clinicId: string,
  id: string,
): Promise<Appointment | null> {
  return prisma.appointment.findFirst({ where: { id, clinicId } });
}

export async function createAppointment(
  clinicId: string,
  input: NewAppointmentInput,
  db: Db = prisma,
): Promise<Appointment> {
  if (input.patientId) {
    const patient = await db.patient.findFirst({
      where: { id: input.patientId, clinicId },
    });
    if (!patient) {
      throw new Error("Patient not found for this clinic");
    }
  }

  const durationMinutes = input.durationMinutes ?? 30;
  const conflict = await findConflict(db, clinicId, input.startsAt, durationMinutes);
  if (conflict) {
    throw new Error("Ya hay un turno agendado en ese horario");
  }

  return db.appointment.create({
    data: {
      clinicId,
      patientId: input.patientId ?? null,
      startsAt: input.startsAt,
      durationMinutes,
      reason: input.reason ?? null,
      status: input.status ?? "CONFIRMED",
      notes: input.notes ?? null,
    },
  });
}

export async function updateAppointment(
  clinicId: string,
  id: string,
  input: UpdateAppointmentInput,
  db: Db = prisma,
): Promise<Appointment> {
  const existing = await db.appointment.findFirst({ where: { id, clinicId } });
  if (!existing) {
    throw new Error("Appointment not found for this clinic");
  }

  if (input.patientId) {
    const patient = await db.patient.findFirst({
      where: { id: input.patientId, clinicId },
    });
    if (!patient) {
      throw new Error("Patient not found for this clinic");
    }
  }

  const startsAt = input.startsAt ?? existing.startsAt;
  const durationMinutes = input.durationMinutes ?? existing.durationMinutes;
  const status = input.status ?? existing.status;

  if (status !== "CANCELLED") {
    const conflict = await findConflict(db, clinicId, startsAt, durationMinutes, id);
    if (conflict) {
      throw new Error("Ya hay un turno agendado en ese horario");
    }
  }

  return db.appointment.update({
    where: { id },
    data: {
      patientId: input.patientId !== undefined ? input.patientId : existing.patientId,
      startsAt,
      durationMinutes,
      reason: input.reason !== undefined ? input.reason : existing.reason,
      status,
      notes: input.notes !== undefined ? input.notes : existing.notes,
    },
  });
}

export async function deleteAppointment(clinicId: string, id: string): Promise<void> {
  await prisma.appointment.deleteMany({ where: { id, clinicId } });
}
