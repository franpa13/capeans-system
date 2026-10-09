import { prisma } from "@/lib/prisma";
import type { Patient, Prisma } from "@prisma/client";
import { NO_INSURANCE, OTHER_INSURANCE } from "@/features/clinic/lib/insurance";

type Db = Prisma.TransactionClient | typeof prisma;

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

export type PatientListFilters = {
  query?: string;
  /** An exact insurance label, or the NO_INSURANCE / OTHER_INSURANCE
   * sentinel — undefined means no insurance filter at all. */
  insurance?: string;
};

export async function getPatients(
  clinicId: string,
  filters: PatientListFilters = {},
  insuranceOptions: string[] = [],
): Promise<Patient[]> {
  const where: Prisma.PatientWhereInput = { clinicId };

  if (filters.query) {
    where.name = { contains: filters.query, mode: "insensitive" };
  }

  if (filters.insurance === NO_INSURANCE) {
    where.OR = [{ insurance: null }, { insurance: NO_INSURANCE }];
  } else if (filters.insurance === OTHER_INSURANCE) {
    where.insurance = { not: null, notIn: [NO_INSURANCE, ...insuranceOptions] };
  } else if (filters.insurance) {
    where.insurance = filters.insurance;
  }

  return prisma.patient.findMany({
    where,
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
  db: Db = prisma,
): Promise<Patient> {
  return db.patient.create({
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
