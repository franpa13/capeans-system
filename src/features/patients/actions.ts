"use server";

import { runAction } from "@/lib/action-result";
import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";
import { getCurrentClinic } from "@/features/clinic/data/current-clinic";
import {
  createPatient,
  deletePatient,
  updatePatient,
  type NewPatientInput,
} from "@/features/clinic/data/patients";
import { addPatientFile, deletePatientFile } from "@/features/clinic/data/patient-files";
import { addPatientNote, deletePatientNote } from "@/features/clinic/data/patient-notes";
import {
  addToothFindings,
  deleteToothFinding,
  getToothFindings,
  setToothFindingStatus,
  type NewToothFindingInput,
} from "@/features/clinic/data/tooth-findings";
import type { FindingStatus } from "@/features/clinic/lib/findings";
import {
  createPrescription,
  deletePrescription,
  type NewPrescriptionInput,
} from "@/features/clinic/data/prescriptions";

async function requireClinicId(): Promise<string> {
  const clinic = await getCurrentClinic();
  if (!clinic) throw new Error("No hay un consultorio activo para este usuario");
  return clinic.id;
}

export async function createPatientAction(input: NewPatientInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const patient = await createPatient(clinicId, input);
    revalidatePath("/dashboard/pacientes");
    return patient;
  });
}

export async function updatePatientAction(id: string, input: NewPatientInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const patient = await updatePatient(clinicId, id, input);
    revalidatePath("/dashboard/pacientes");
    revalidatePath(`/dashboard/pacientes/${id}`);
    return patient;
  });
}

export async function deletePatientAction(id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deletePatient(clinicId, id);
    revalidatePath("/dashboard/pacientes");
  });
}

/** One file per call (the dialog uploads a multi-selection one by one, so
 * a single bad file doesn't sink the rest). */
export async function uploadPatientFileAction(patientId: string, formData: FormData) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) throw new Error("Elegí un archivo");
    await addPatientFile(clinicId, patientId, {
      fileName: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

export async function deletePatientFileAction(patientId: string, fileId: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deletePatientFile(clinicId, fileId);
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

async function currentAuthorName(): Promise<string | null> {
  const user = await currentUser();
  return user?.fullName || user?.firstName || user?.primaryEmailAddress?.emailAddress || null;
}

/** An observación on the ficha, signed with the logged-in user's name. */
export async function addPatientNoteAction(patientId: string, text: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const authorName = await currentAuthorName();
    await addPatientNote(clinicId, patientId, { text, authorName });
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

export async function deletePatientNoteAction(patientId: string, id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deletePatientNote(clinicId, id);
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

/** A hallazgo on the odontograma, signed with the logged-in user's name. */
export async function addToothFindingsAction(
  patientId: string,
  input: Omit<NewToothFindingInput, "authorName">,
) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await addToothFindings(clinicId, patientId, { ...input, authorName: await currentAuthorName() });
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

export async function setToothFindingStatusAction(patientId: string, id: string, status: FindingStatus) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await setToothFindingStatus(clinicId, id, status);
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

export async function deleteToothFindingAction(patientId: string, id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deleteToothFinding(clinicId, id);
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}

/** The patient's pending hallazgos, for Nueva consulta to offer resolving. */
export async function getPendingFindingsAction(patientId: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const findings = await getToothFindings(clinicId, patientId);
    return findings
      .filter((f) => f.status === "PENDING")
      .map((f) => ({ id: f.id, tooth: f.tooth, surface: f.surface, condition: f.condition }));
  });
}

/** Issues a receta; returns its id to open it. */
export async function createPrescriptionAction(patientId: string, input: NewPrescriptionInput) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    const prescription = await createPrescription(clinicId, patientId, input);
    revalidatePath(`/dashboard/pacientes/${patientId}`);
    return { id: prescription.id };
  });
}

export async function deletePrescriptionAction(patientId: string, id: string) {
  return runAction(async () => {
    const clinicId = await requireClinicId();
    await deletePrescription(clinicId, id);
    revalidatePath(`/dashboard/pacientes/${patientId}`);
  });
}
