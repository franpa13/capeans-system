import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createPatient,
  deletePatient,
  getPatient,
  getPatients,
  updatePatient,
} from "@/features/clinic/data/patients";

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
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("patients data layer", () => {
  it("creates a patient scoped to the given clinic", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Lucía Fernández",
      phone: "11 4455-2201",
    });
    expect(patient.clinicId).toBe(clinicA.id);
  });

  it("does not return a clinic A patient when queried with clinic B's id", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Lucía Fernández",
      phone: "11 4455-2201",
    });
    const result = await getPatient(clinicB.id, patient.id);
    expect(result).toBeNull();
  });

  it("lists only patients belonging to the requested clinic", async () => {
    await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });

    const listA = await getPatients(clinicA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].name).toBe("Paciente A");
  });

  it("refuses to update a patient belonging to another clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });

    await expect(
      updatePatient(clinicB.id, patient.id, { name: "Hackeado", phone: "000" }),
    ).rejects.toThrow("Patient not found for this clinic");

    const stillOriginal = await getPatient(clinicA.id, patient.id);
    expect(stillOriginal?.name).toBe("Paciente A");
  });

  it("refuses to delete a patient belonging to another clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });

    await deletePatient(clinicB.id, patient.id);

    const stillThere = await getPatient(clinicA.id, patient.id);
    expect(stillThere).not.toBeNull();
  });

  it("ignores a clinicId injected into the create input, using the argument instead", async () => {
    const injected = {
      name: "Paciente Inyectado",
      phone: "111",
      clinicId: clinicB.id,
    } as Parameters<typeof createPatient>[1];

    const patient = await createPatient(clinicA.id, injected);

    expect(patient.clinicId).toBe(clinicA.id);
  });

  it("ignores a clinicId injected into the update input, using the argument instead", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const injected = {
      name: "Paciente A",
      phone: "111",
      clinicId: clinicB.id,
    } as Parameters<typeof updatePatient>[2];

    const updated = await updatePatient(clinicA.id, patient.id, injected);

    expect(updated.clinicId).toBe(clinicA.id);
  });

  it("clears an optional field when the update omits it, instead of leaving the old value", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Paciente A",
      phone: "111",
      allergies: "Penicilina",
    });

    const updated = await updatePatient(clinicA.id, patient.id, {
      name: "Paciente A",
      phone: "111",
      allergies: undefined,
    });

    expect(updated.allergies).toBeNull();
  });
});
