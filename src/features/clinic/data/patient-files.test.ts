import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { createPatient, deletePatient } from "@/features/clinic/data/patients";
import {
  addPatientFile,
  deletePatientFile,
  getPatientFile,
  getPatientFiles,
  readPatientFile,
} from "@/features/clinic/data/patient-files";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

let dir: string;
let clinicA: { id: string };
let clinicB: { id: string };

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "dentia-files-"));
  process.env.UPLOADS_DIR = dir;
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});
beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "B" } });
});
afterEach(async () => {
  await prisma.patientFile.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

async function filesOnDisk(clinicId: string) {
  return readdir(path.join(dir, clinicId)).catch(() => [] as string[]);
}

describe("patient files", () => {
  it("stores an image with its detected type and lists it on the patient", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    const file = await addPatientFile(clinicA.id, patient.id, { fileName: "panoramica.png", buffer: PNG });
    expect(file).toMatchObject({ fileName: "panoramica.png", mimeType: "image/png", size: PNG.length });
    expect((await getPatientFiles(clinicA.id, patient.id)).map((f) => f.id)).toEqual([file.id]);
    expect(await readPatientFile(file)).toEqual(PNG);
  });

  it("refuses something that isn't an image or a PDF, whatever its name", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    await expect(
      addPatientFile(clinicA.id, patient.id, { fileName: "foto.png", buffer: Buffer.from("<html>") }),
    ).rejects.toThrow("Solo se pueden subir imágenes (JPG, PNG, WEBP, GIF) o archivos PDF");
    expect(await filesOnDisk(clinicA.id)).toEqual([]);
  });

  it("refuses a file over 15 MB", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    const big = Buffer.concat([PNG, Buffer.alloc(15 * 1024 * 1024)]);
    await expect(addPatientFile(clinicA.id, patient.id, { fileName: "x.png", buffer: big })).rejects.toThrow(
      "El archivo es muy grande (máximo 15 MB)",
    );
  });

  it("keeps each clinic's files to itself", async () => {
    const theirs = await createPatient(clinicB.id, { name: "Beto", phone: "2" });
    await expect(
      addPatientFile(clinicA.id, theirs.id, { fileName: "x.png", buffer: PNG }),
    ).rejects.toThrow("Patient not found for this clinic");
    const file = await addPatientFile(clinicB.id, theirs.id, { fileName: "x.png", buffer: PNG });
    await expect(getPatientFile(clinicA.id, file.id)).resolves.toBeNull();
    await expect(deletePatientFile(clinicA.id, file.id)).rejects.toThrow("File not found for this clinic");
  });

  it("deleting a file removes it from disk too", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    const file = await addPatientFile(clinicA.id, patient.id, { fileName: "x.png", buffer: PNG });
    await deletePatientFile(clinicA.id, file.id);
    expect(await getPatientFiles(clinicA.id, patient.id)).toEqual([]);
    expect(await filesOnDisk(clinicA.id)).toEqual([]);
  });

  it("deleting the patient removes their files from disk", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana", phone: "1" });
    await addPatientFile(clinicA.id, patient.id, { fileName: "x.png", buffer: PNG });
    await deletePatient(clinicA.id, patient.id);
    expect(await filesOnDisk(clinicA.id)).toEqual([]);
  });
});
