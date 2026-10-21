import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  addPatientNote,
  deletePatientNote,
  getPatientNotes,
} from "@/features/clinic/data/patient-notes";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({
    data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" },
  });
  clinicB = await prisma.clinic.create({
    data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" },
  });
});

afterEach(async () => {
  await prisma.patientNote.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("patient notes (observaciones)", () => {
  it("adds a trimmed observación with its author, newest first", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    await addPatientNote(clinicA.id, patient.id, { text: "  Primera  ", authorName: "Dra. Paz" });
    await new Promise((r) => setTimeout(r, 5));
    await addPatientNote(clinicA.id, patient.id, { text: "Segunda", authorName: null });

    const notes = await getPatientNotes(clinicA.id, patient.id);
    expect(notes.map((n) => [n.text, n.authorName])).toEqual([
      ["Segunda", null],
      ["Primera", "Dra. Paz"],
    ]);
  });

  it("rejects an empty observación", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    await expect(
      addPatientNote(clinicA.id, patient.id, { text: "   ", authorName: null }),
    ).rejects.toThrow("Escribí la observación");
  });

  it("can't touch another clinic's patient or notes", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    await expect(
      addPatientNote(clinicB.id, patient.id, { text: "Hola", authorName: null }),
    ).rejects.toThrow();
    const note = await addPatientNote(clinicA.id, patient.id, { text: "Hola", authorName: null });
    expect(await getPatientNotes(clinicB.id, patient.id)).toEqual([]);
    await expect(deletePatientNote(clinicB.id, note.id)).rejects.toThrow();

    await deletePatientNote(clinicA.id, note.id);
    expect(await getPatientNotes(clinicA.id, patient.id)).toEqual([]);
  });
});
