"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import { createConsultation, type NewConsultationInput } from "@/features/clinic/data/consultations";
import { createPatient, type NewPatientInput } from "@/features/clinic/data/patients";

export async function createConsultationAction(
  input: NewConsultationInput & { newPatient?: NewPatientInput },
) {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");

  const { newPatient, ...consultationInput } = input;
  let patientId = consultationInput.patientId;
  if (newPatient) {
    const patient = await createPatient(clinic.id, newPatient);
    patientId = patient.id;
  }

  const consultation = await createConsultation(clinic.id, {
    ...consultationInput,
    patientId,
  });
  revalidatePath("/dashboard/consultas");
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  return consultation;
}
