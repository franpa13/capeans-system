import { prisma } from "@/lib/prisma";
import type { PatientFile } from "@prisma/client";
import { detectFileType, readStoredFile, removeStoredFile, storeFile } from "@/lib/file-storage";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export async function addPatientFile(
  clinicId: string,
  patientId: string,
  input: { fileName: string; buffer: Buffer },
): Promise<PatientFile> {
  const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
  if (!patient) throw new Error("Patient not found for this clinic");
  if (input.buffer.length > MAX_FILE_BYTES) throw new Error("El archivo es muy grande (máximo 15 MB)");
  const mimeType = detectFileType(input.buffer);
  if (!mimeType) {
    throw new Error("Solo se pueden subir imágenes (JPG, PNG, WEBP, GIF) o archivos PDF");
  }

  const storageKey = await storeFile(clinicId, input.buffer);
  try {
    return await prisma.patientFile.create({
      data: {
        clinicId,
        patientId,
        fileName: input.fileName.trim().slice(0, 200) || "archivo",
        mimeType,
        size: input.buffer.length,
        storageKey,
      },
    });
  } catch (error) {
    await removeStoredFile(storageKey);
    throw error;
  }
}

export async function getPatientFiles(clinicId: string, patientId: string): Promise<PatientFile[]> {
  return prisma.patientFile.findMany({
    where: { clinicId, patientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPatientFile(clinicId: string, id: string): Promise<PatientFile | null> {
  return prisma.patientFile.findFirst({ where: { id, clinicId } });
}

export async function readPatientFile(file: PatientFile): Promise<Buffer> {
  return readStoredFile(file.storageKey);
}

export async function deletePatientFile(clinicId: string, id: string): Promise<void> {
  const file = await getPatientFile(clinicId, id);
  if (!file) throw new Error("File not found for this clinic");
  await prisma.patientFile.delete({ where: { id } });
  await removeStoredFile(file.storageKey);
}

/** Before a patient is deleted (their rows cascade away), their files'
 * bytes are removed from disk so nothing is left orphaned. */
export async function removePatientFilesFromDisk(clinicId: string, patientId: string) {
  const files = await prisma.patientFile.findMany({
    where: { clinicId, patientId },
    select: { storageKey: true },
  });
  await Promise.all(files.map((f) => removeStoredFile(f.storageKey)));
}
