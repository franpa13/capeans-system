import { prisma } from "@/lib/prisma";
import type { Consultation, Prisma } from "@prisma/client";
import { OTHER_TREATMENT } from "@/features/clinic/lib/treatments";
import { paymentStatus, type PaymentStatus } from "@/features/clinic/lib/billing";

export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
  appointmentId?: string;
  supplies?: SupplyUsageInput[];
};

/** Checks a consulta may be linked to this turno and, if the turno was
 * still CONFIRMED, marks it COMPLETED — registering what was done at a
 * turno means the turno happened. `ownConsultationId` is the consulta
 * being edited, so re-saving it with its own turno isn't a "duplicate". */
async function linkAppointment(
  tx: Prisma.TransactionClient,
  clinicId: string,
  appointmentId: string,
  patientId: string | null,
  ownConsultationId?: string,
) {
  const appointment = await tx.appointment.findFirst({
    where: { id: appointmentId, clinicId },
    include: { consultation: { select: { id: true } } },
  });
  if (!appointment) {
    throw new Error("Turno no encontrado");
  }
  if (appointment.status === "CANCELLED") {
    throw new Error("No se puede vincular un turno cancelado");
  }
  if (appointment.patientId !== patientId) {
    throw new Error("El turno es de otro paciente");
  }
  if (appointment.consultation && appointment.consultation.id !== ownConsultationId) {
    throw new Error("Ese turno ya tiene una consulta registrada");
  }
  if (appointment.status === "CONFIRMED") {
    await tx.appointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } });
  }
}

export type SupplyUsageInput = { supplyId: string; quantityUsed: number };

export function assertValidSupplyUsages(supplies: SupplyUsageInput[] | undefined) {
  for (const usage of supplies ?? []) {
    if (!Number.isInteger(usage.quantityUsed) || usage.quantityUsed <= 0) {
      throw new Error("La cantidad usada tiene que ser un número entero mayor a 0");
    }
  }
}

/** Decrements each used supply's stock (scoped to the clinic, so another
 * clinic's supply id is never touched) and records the usage row. Runs
 * inside the caller's transaction, never on its own, so stock and usage
 * rows can't drift apart. Stock may go negative on purpose — that's the
 * "reponé ya" signal, not an error. */
async function applySupplyUsages(
  tx: Prisma.TransactionClient,
  clinicId: string,
  consultationId: string,
  supplies: SupplyUsageInput[] | undefined,
) {
  for (const usage of supplies ?? []) {
    const updated = await tx.supply.updateMany({
      where: { id: usage.supplyId, clinicId },
      data: { quantity: { decrement: usage.quantityUsed } },
    });
    if (updated.count === 0) {
      throw new Error("Insumo no encontrado");
    }
    await tx.consultationSupply.create({
      data: { consultationId, supplyId: usage.supplyId, quantityUsed: usage.quantityUsed },
    });
  }
}

/** Restores stock for every supply usage currently attached to a
 * consultation, then removes those rows — the first half of "reconcile":
 * undo the old state before applying the new one. */
async function reverseSupplyUsages(tx: Prisma.TransactionClient, consultationId: string) {
  const existing = await tx.consultationSupply.findMany({ where: { consultationId } });
  for (const usage of existing) {
    await tx.supply.update({
      where: { id: usage.supplyId },
      data: { quantity: { increment: usage.quantityUsed } },
    });
  }
  await tx.consultationSupply.deleteMany({ where: { consultationId } });
}

export type ConsultationListFilters = {
  /** An exact treatment label, or the OTHER_TREATMENT sentinel — undefined
   * means no treatment filter at all. */
  treatment?: string;
  /** "YYYY-MM-DD", inclusive, compared in local time to match how the date
   * inputs and the stored visit time are read elsewhere (see format.ts). */
  from?: string;
  to?: string;
  patientQuery?: string;
  /** A tooth number, matched exactly against entries in `teeth`. */
  tooth?: string;
  /** One status, or several (e.g. the dashboard's "Por cobrar" link wants
   * PENDIENTE and PARCIAL together) — undefined means no filter at all.
   * Applied in memory after the Prisma query: amountPaid vs amountCharged
   * is a per-row comparison between two columns, which Prisma's filter
   * DSL can't express directly, and a raw SQL expression isn't worth it
   * at this app's scale (a single clinic's consultations, not millions
   * of rows). */
  paymentStatus?: PaymentStatus | PaymentStatus[];
};

export async function getConsultations(
  clinicId: string,
  filters: ConsultationListFilters = {},
  treatmentOptions: string[] = [],
): Promise<Consultation[]> {
  const where: Prisma.ConsultationWhereInput = { clinicId };

  if (filters.treatment === OTHER_TREATMENT) {
    where.treatment = { notIn: treatmentOptions };
  } else if (filters.treatment) {
    where.treatment = filters.treatment;
  }

  if (filters.from || filters.to) {
    where.date = {
      ...(filters.from ? { gte: new Date(`${filters.from}T00:00:00`) } : {}),
      ...(filters.to ? { lte: new Date(`${filters.to}T23:59:59.999`) } : {}),
    };
  }

  if (filters.patientQuery) {
    where.patient = { name: { contains: filters.patientQuery, mode: "insensitive" } };
  }

  if (filters.tooth) {
    where.teeth = { has: filters.tooth };
  }

  const results = await prisma.consultation.findMany({
    where,
    orderBy: { date: "desc" },
  });

  if (!filters.paymentStatus) return results;
  const wanted = Array.isArray(filters.paymentStatus)
    ? filters.paymentStatus
    : [filters.paymentStatus];
  return results.filter((c) => wanted.includes(paymentStatus(c.amountCharged, c.amountPaid)));
}

export async function getConsultation(
  clinicId: string,
  id: string,
): Promise<Consultation | null> {
  return prisma.consultation.findFirst({ where: { id, clinicId } });
}

export type ConsultationUsage = {
  supplyId: string;
  supplyName: string;
  unit: string;
  quantityUsed: number;
};

/** Separate from getConsultation on purpose: the Edit dialog is the only
 * place that needs a consulta's existing supply usages (to prefill
 * "Insumos utilizados"); every list and the view dialog have no use for
 * them, so they don't pay for the join. */
export async function getConsultationUsages(
  clinicId: string,
  consultationId: string,
): Promise<ConsultationUsage[]> {
  const usages = await prisma.consultationSupply.findMany({
    where: { consultationId, consultation: { clinicId } },
    include: { supply: true },
    orderBy: { supply: { name: "asc" } },
  });
  return usages.map((u) => ({
    supplyId: u.supplyId,
    supplyName: u.supply.name,
    unit: u.supply.unit,
    quantityUsed: u.quantityUsed,
  }));
}

export async function getConsultationsForPatient(
  clinicId: string,
  patientId: string,
): Promise<Consultation[]> {
  return prisma.consultation.findMany({
    where: { clinicId, patientId },
    orderBy: { date: "desc" },
  });
}

export function assertValidAmounts(amountCharged: number | undefined, amountPaid: number | undefined) {
  if (amountCharged != null && !Number.isInteger(amountCharged)) {
    throw new Error("El monto tiene que ser un número entero");
  }
  if (amountPaid != null && !Number.isInteger(amountPaid)) {
    throw new Error("El monto tiene que ser un número entero");
  }
  if (amountCharged != null && amountCharged < 0) {
    throw new Error("El monto no puede ser negativo");
  }
  if (amountPaid != null && amountPaid < 0) {
    throw new Error("El monto no puede ser negativo");
  }
  if (amountPaid != null && amountCharged != null && amountPaid > amountCharged) {
    throw new Error("Lo pagado no puede superar el monto a cobrar");
  }
}

export async function createConsultation(
  clinicId: string,
  input: NewConsultationInput,
): Promise<Consultation> {
  const patient = await prisma.patient.findFirst({
    where: { id: input.patientId, clinicId },
  });
  if (!patient) {
    throw new Error("Patient not found for this clinic");
  }
  assertValidAmounts(input.amountCharged, input.amountPaid);
  assertValidSupplyUsages(input.supplies);

  return prisma.$transaction(async (tx) => {
    if (input.appointmentId) {
      await linkAppointment(tx, clinicId, input.appointmentId, input.patientId);
    }
    const consultation = await tx.consultation.create({
      data: {
        patientId: input.patientId,
        date: input.date,
        treatment: input.treatment,
        teeth: input.teeth ?? [],
        notes: input.notes ?? null,
        amountCharged: input.amountCharged ?? null,
        amountPaid: input.amountPaid ?? 0,
        appointmentId: input.appointmentId ?? null,
        clinicId,
      },
    });
    await applySupplyUsages(tx, clinicId, consultation.id, input.supplies);
    return consultation;
  });
}

export type UpdateConsultationInput = {
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
  /** Like every other field here, the full new value — omitting it (or
   * null) clears the link, the same way omitting notes clears them. */
  appointmentId?: string | null;
  /** Also the full new list — omitting it means "no supplies used", and
   * the previous ones are put back into stock. */
  supplies?: SupplyUsageInput[];
};

export async function updateConsultation(
  clinicId: string,
  id: string,
  input: UpdateConsultationInput,
): Promise<Consultation> {
  assertValidAmounts(input.amountCharged, input.amountPaid);
  assertValidSupplyUsages(input.supplies);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.consultation.findFirst({ where: { id, clinicId } });
    if (!existing) {
      throw new Error("Consultation not found for this clinic");
    }
    if (input.appointmentId) {
      await linkAppointment(tx, clinicId, input.appointmentId, existing.patientId, id);
    }
    await reverseSupplyUsages(tx, id);
    const updated = await tx.consultation.update({
      where: { id },
      data: {
        date: input.date,
        treatment: input.treatment,
        teeth: input.teeth ?? [],
        notes: input.notes ?? null,
        amountCharged: input.amountCharged ?? null,
        amountPaid: input.amountPaid ?? 0,
        appointmentId: input.appointmentId ?? null,
      },
    });
    await applySupplyUsages(tx, clinicId, id, input.supplies);
    return updated;
  });
}

export async function deleteConsultation(clinicId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const consultation = await tx.consultation.findFirst({ where: { id, clinicId } });
    if (!consultation) return;
    await reverseSupplyUsages(tx, id);
    await tx.consultation.delete({ where: { id } });
  });
}
