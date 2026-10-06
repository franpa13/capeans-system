import { prisma } from "@/lib/prisma";
import type { Consultation } from "@prisma/client";

export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
};

export async function getConsultations(clinicId: string): Promise<Consultation[]> {
  return prisma.consultation.findMany({
    where: { clinicId },
    orderBy: { date: "desc" },
  });
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

  return prisma.consultation.create({
    data: {
      patientId: input.patientId,
      date: input.date,
      treatment: input.treatment,
      teeth: input.teeth ?? [],
      notes: input.notes ?? null,
      clinicId,
    },
  });
}

export type UpdateConsultationInput = {
  date: Date;
  treatment: string;
  teeth?: string[];
  notes?: string;
};

export async function updateConsultation(
  clinicId: string,
  id: string,
  input: UpdateConsultationInput,
): Promise<Consultation> {
  const result = await prisma.consultation.updateMany({
    where: { id, clinicId },
    data: {
      date: input.date,
      treatment: input.treatment,
      teeth: input.teeth ?? [],
      notes: input.notes ?? null,
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
