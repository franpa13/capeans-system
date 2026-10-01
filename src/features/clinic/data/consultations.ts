import { prisma } from "@/lib/prisma";
import type { Consultation } from "@prisma/client";

export type NewConsultationInput = {
  patientId: string;
  date: Date;
  treatment: string;
  tooth?: string;
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
  return prisma.consultation.create({ data: { ...input, clinicId } });
}
