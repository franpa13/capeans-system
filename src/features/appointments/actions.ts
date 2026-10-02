"use server";

import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
  type NewAppointmentInput,
  type UpdateAppointmentInput,
} from "@/features/clinic/data/appointments";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createAppointmentAction(input: NewAppointmentInput) {
  const clinicId = await requireClinicId();
  const appointment = await createAppointment(clinicId, input);
  revalidatePath("/dashboard/turnos");
  return appointment;
}

export async function updateAppointmentAction(id: string, input: UpdateAppointmentInput) {
  const clinicId = await requireClinicId();
  const appointment = await updateAppointment(clinicId, id, input);
  revalidatePath("/dashboard/turnos");
  return appointment;
}

export async function deleteAppointmentAction(id: string) {
  const clinicId = await requireClinicId();
  await deleteAppointment(clinicId, id);
  revalidatePath("/dashboard/turnos");
}
