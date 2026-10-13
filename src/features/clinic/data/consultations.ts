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
};

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

export async function getConsultationsForPatient(
  clinicId: string,
  patientId: string,
): Promise<Consultation[]> {
  return prisma.consultation.findMany({
    where: { clinicId, patientId },
    orderBy: { date: "desc" },
  });
}

function assertValidAmounts(amountCharged: number | undefined, amountPaid: number | undefined) {
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

  return prisma.consultation.create({
    data: {
      patientId: input.patientId,
      date: input.date,
      treatment: input.treatment,
      teeth: input.teeth ?? [],
      notes: input.notes ?? null,
      amountCharged: input.amountCharged ?? null,
      amountPaid: input.amountPaid ?? 0,
      clinicId,
    },
  });
}

export type UpdateConsultationInput = {
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
  amountCharged?: number;
  amountPaid?: number;
};

export async function updateConsultation(
  clinicId: string,
  id: string,
  input: UpdateConsultationInput,
): Promise<Consultation> {
  assertValidAmounts(input.amountCharged, input.amountPaid);

  const result = await prisma.consultation.updateMany({
    where: { id, clinicId },
    data: {
      date: input.date,
      treatment: input.treatment,
      teeth: input.teeth ?? [],
      notes: input.notes ?? null,
      amountCharged: input.amountCharged ?? null,
      amountPaid: input.amountPaid ?? 0,
    },
  });
  if (result.count === 0) {
    throw new Error("Consultation not found for this clinic");
  }
  return (await getConsultation(clinicId, id))!;
}

export async function deleteConsultation(clinicId: string, id: string): Promise<void> {
  await prisma.consultation.deleteMany({ where: { id, clinicId } });
}
