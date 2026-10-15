"use server";

import { runAction, type ActionResult } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  assertValidAmounts,
  assertValidSupplyUsages,
  createConsultation,
  deleteConsultation,
  getConsultation,
  getConsultationUsages,
  type ConsultationUsage,
  updateConsultation,
  type NewConsultationInput,
  type UpdateConsultationInput,
} from "@/features/clinic/data/consultations";
import { createPatient, type NewPatientInput } from "@/features/clinic/data/patients";
import { getLinkableAppointments } from "@/features/clinic/data/appointments";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createConsultationAction(
  input: NewConsultationInput & { newPatient?: NewPatientInput },
) {
  return runAction(async () => {
    const clinicId = await requireClinicId();

    const { newPatient, ...consultationInput } = input;
    // Validated before createPatient runs, not after: createConsultation
    // would reject the same input, but by then a new patient with no
    // consultation to show for it would already be sitting in the DB.
    assertValidAmounts(consultationInput.amountCharged, consultationInput.amountPaid);
    assertValidSupplyUsages(consultationInput.supplies);

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
    // Linking can complete a turno, and the agenda shows which completed
    // turnos still lack their consulta.
    revalidatePath("/dashboard/turnos");
    return consultation;
  });
}

export async function updateConsultationAction(id: string, input: UpdateConsultationInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const consultation = await updateConsultation(clinicId, id, input);
    revalidatePath("/dashboard/consultas");
    if (consultation.patientId) revalidatePath(`/dashboard/pacientes/${consultation.patientId}`);
    revalidatePath("/dashboard/turnos");
    return consultation;
  });
}

export async function deleteConsultationAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const consultation = await getConsultation(clinicId, id);
    await deleteConsultation(clinicId, id);
    revalidatePath("/dashboard/consultas");
    if (consultation?.patientId) revalidatePath(`/dashboard/pacientes/${consultation.patientId}`);
    revalidatePath("/dashboard/turnos");
  });
}

/** The supplies a consulta already used, for prefilling its edit form. */
export async function getConsultationUsagesAction(
  consultationId: string,
): Promise<ActionResult<ConsultationUsage[]>> {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    return getConsultationUsages(clinicId, consultationId);
  });
}

export type LinkableAppointment = {
  id: string;
  startsAt: string;
  reason: string | null;
  status: string;
};

/** The turnos the consulta form offers to link to, for one patient on one
 * local day ("YYYY-MM-DD") — re-fetched every time the form's patient or
 * date changes. */
export async function getLinkableAppointmentsAction(
  patientId: string,
  day: string,
  excludeConsultationId?: string,
): Promise<ActionResult<LinkableAppointment[]>> {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const appointments = await getLinkableAppointments(clinicId, patientId, day, excludeConsultationId);
    return appointments.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      reason: a.reason,
      status: a.status,
    }));
  });
}
