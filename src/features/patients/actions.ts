"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createPatient,
  deletePatient,
  updatePatient,
  type NewPatientInput,
} from "@/features/clinic/data/patients";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createPatientAction(input: NewPatientInput) {
  const clinicId = await requireClinicId();
  const patient = await createPatient(clinicId, input);
  revalidatePath("/dashboard/pacientes");
  return patient;
}

export async function updatePatientAction(id: string, input: NewPatientInput) {
  const clinicId = await requireClinicId();
  const patient = await updatePatient(clinicId, id, input);
  revalidatePath("/dashboard/pacientes");
  revalidatePath(`/dashboard/pacientes/${id}`);
  return patient;
}

export async function deletePatientAction(id: string) {
  const clinicId = await requireClinicId();
  await deletePatient(clinicId, id);
  revalidatePath("/dashboard/pacientes");
}
