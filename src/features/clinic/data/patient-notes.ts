import { prisma } from "@/lib/prisma";
import type { PatientNote } from "@prisma/client";

const MAX_NOTE_LENGTH = 2000;

/** The patient's observaciones, newest first. */
export async function getPatientNotes(clinicId: string, patientId: string): Promise<PatientNote[]> {
  return prisma.patientNote.findMany({
    where: { clinicId, patientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function addPatientNote(
  clinicId: string,
  patientId: string,
  input: { text: string; authorName: string | null },
): Promise<PatientNote> {
  const text = input.text.trim();
  if (!text) throw new Error("Escribí la observación");
  if (text.length > MAX_NOTE_LENGTH) {
    throw new Error(`La observación puede tener hasta ${MAX_NOTE_LENGTH} caracteres`);
  }
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw new Error("Patient not found for this clinic");
  return prisma.patientNote.create({
    data: { clinicId, patientId, text, authorName: input.authorName?.trim() || null },
  });
}

export async function deletePatientNote(clinicId: string, id: string): Promise<void> {
  const result = await prisma.patientNote.deleteMany({ where: { id, clinicId } });
  if (result.count === 0) throw new Error("Note not found for this clinic");
}
