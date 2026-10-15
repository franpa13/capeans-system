"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createAppointment,
  deleteAppointment,
  markReminderSent,
  updateAppointment,
  type NewAppointmentInput,
  type UpdateAppointmentInput,
} from "@/features/clinic/data/appointments";
import { createPatient, type NewPatientInput } from "@/features/clinic/data/patients";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createAppointmentAction(
  input: NewAppointmentInput & { newPatient?: NewPatientInput },
) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const { newPatient, ...appointmentInput } = input;

    // A conflicting slot leaves the dialog open for the user to retry with
    // the same "new patient" fields still filled in — without a shared
    // transaction, each retry would create another orphan duplicate patient
    // before the conflict check ever runs.
    const { appointment, patientId } = await prisma.$transaction(async (tx) => {
      let patientId = appointmentInput.patientId;
      if (newPatient) {
        const patient = await createPatient(clinicId, newPatient, tx);
        patientId = patient.id;
      }
      const appointment = await createAppointment(clinicId, { ...appointmentInput, patientId }, tx);
      return { appointment, patientId };
    });

    revalidatePath("/dashboard/turnos");
    if (patientId) revalidatePath(`/dashboard/pacientes/${patientId}`);
    return appointment;
  });
}

export async function updateAppointmentAction(
  id: string,
  input: UpdateAppointmentInput & { newPatient?: NewPatientInput },
) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const { newPatient, ...appointmentInput } = input;

    const { appointment, patientId } = await prisma.$transaction(async (tx) => {
      let patientId = appointmentInput.patientId;
      if (newPatient) {
        const patient = await createPatient(clinicId, newPatient, tx);
        patientId = patient.id;
      }
      const appointment = await updateAppointment(
        clinicId,
        id,
        { ...appointmentInput, ...(newPatient ? { patientId } : {}) },
        tx,
      );
      return { appointment, patientId };
    });

    revalidatePath("/dashboard/turnos");
    if (patientId) revalidatePath(`/dashboard/pacientes/${patientId}`);
    return appointment;
  });
}

export async function deleteAppointmentAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deleteAppointment(clinicId, id);
    revalidatePath("/dashboard/turnos");
  });
}

/** Called when the dentist opens the WhatsApp reminder for a turno. */
export async function markReminderSentAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await markReminderSent(clinicId, id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/turnos");
  });
}
