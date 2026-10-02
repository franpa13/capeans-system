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

function toPatientWriteData(input: NewPatientInput) {
  return {
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    dni: input.dni ?? null,
    birthDate: input.birthDate ?? null,
    address: input.address ?? null,
    insurance: input.insurance ?? null,
    allergies: input.allergies ?? null,
  };
}

export async function createPatient(
  clinicId: string,
  input: NewPatientInput,
): Promise<Patient> {
  return prisma.patient.create({
    data: { ...toPatientWriteData(input), clinicId },
  });
}

export async function updatePatient(
  clinicId: string,
  id: string,
  input: NewPatientInput,
): Promise<Patient> {
  const result = await prisma.patient.updateMany({
    where: { id, clinicId },
    data: toPatientWriteData(input),
  });
  if (result.count === 0) {
    throw new Error("Patient not found for this clinic");
  }
  return (await getPatient(clinicId, id))!;
}

export async function deletePatient(clinicId: string, id: string): Promise<void> {
  await prisma.patient.deleteMany({ where: { id, clinicId } });
}
