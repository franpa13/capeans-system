import { prisma } from "@/lib/prisma";
import type { Patient } from "@prisma/client";

export type NewPatientInput = {
  name: string;
  phone: string;
  email?: string;
  dni?: string;
  birthDate?: Date;
  address?: string;
  insurance?: string;
  allergies?: string;
};

export async function getPatients(clinicId: string): Promise<Patient[]> {
  return prisma.patient.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
}

export async function getPatient(clinicId: string, id: string): Promise<Patient | null> {
  return prisma.patient.findFirst({ where: { id, clinicId } });
}

export async function createPatient(
  clinicId: string,
  input: NewPatientInput,
): Promise<Patient> {
  return prisma.patient.create({ data: { ...input, clinicId } });
}

export async function updatePatient(
  clinicId: string,
  id: string,
  input: NewPatientInput,
): Promise<Patient> {
  const result = await prisma.patient.updateMany({
    where: { id, clinicId },
    data: input,
  });
  if (result.count === 0) {
    throw new Error("Patient not found for this clinic");
  }
  return (await getPatient(clinicId, id))!;
}

export async function deletePatient(clinicId: string, id: string): Promise<void> {
  await prisma.patient.deleteMany({ where: { id, clinicId } });
}
