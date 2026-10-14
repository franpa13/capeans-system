"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  assertValidAmounts,
  createConsultation,
  deleteConsultation,
  getConsultation,
  updateConsultation,
  type NewConsultationInput,
  type UpdateConsultationInput,
} from "@/features/clinic/data/consultations";
import { createPatient, type NewPatientInput } from "@/features/clinic/data/patients";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createConsultationAction(
  input: NewConsultationInput & { newPatient?: NewPatientInput },
) {
  const clinicId = await requireClinicId();

  const { newPatient, ...consultationInput } = input;
  // Validated before createPatient runs, not after: createConsultation
  // would reject the same input, but by then a new patient with no
  // consultation to show for it would already be sitting in the DB.
  assertValidAmounts(consultationInput.amountCharged, consultationInput.amountPaid);

  let patientId = consultationInput.patientId;
  if (newPatient) {
    const patient = await createPatient(clinicId, newPatient);
    patientId = patient.id;
  }

  const consultation = await createConsultation(clinicId, {
    ...consultationInput,
    patientId,
  });
  revalidatePath("/dashboard/consultas");
  revalidatePath(`/dashboard/pacientes/${patientId}`);
  return consultation;
}

export async function updateConsultationAction(id: string, input: UpdateConsultationInput) {
  const clinicId = await requireClinicId();
  const consultation = await updateConsultation(clinicId, id, input);
  revalidatePath("/dashboard/consultas");
  if (consultation.patientId) revalidatePath(`/dashboard/pacientes/${consultation.patientId}`);
  return consultation;
}

export async function deleteConsultationAction(id: string) {
  const clinicId = await requireClinicId();
  const consultation = await getConsultation(clinicId, id);
  await deleteConsultation(clinicId, id);
  revalidatePath("/dashboard/consultas");
  if (consultation?.patientId) revalidatePath(`/dashboard/pacientes/${consultation.patientId}`);
}
