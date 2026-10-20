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

describe("medical history", () => {
  it("stores the n° de afiliado, medication and known medical conditions", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Ana",
      phone: "11 1111-1111",
      insuranceNumber: "123456/01",
      medications: "Sintrom 4mg",
      medicalConditions: ["anticoagulantes", "hipertension"],
    });
    expect(patient.insuranceNumber).toBe("123456/01");
    expect(patient.medications).toBe("Sintrom 4mg");
    expect(patient.medicalConditions).toEqual(["anticoagulantes", "hipertension"]);
  });

  it("drops conditions it doesn't know and clears them on update", async () => {
    const patient = await createPatient(clinicA.id, {
      name: "Ana",
      phone: "11 1111-1111",
      medicalConditions: ["diabetes", "inventada"],
    });
    expect(patient.medicalConditions).toEqual(["diabetes"]);

    const updated = await updatePatient(clinicA.id, patient.id, { name: "Ana", phone: "11 1111-1111" });
    expect(updated.medicalConditions).toEqual([]);
  });
});

describe("nombre, apellido and the full profile", () => {
  it("keeps the full name in sync with nombre and apellido", async () => {
    const patient = await createPatient(clinicA.id, {
      firstName: "María José",
      lastName: "López",
      phone: "1",
    });
    expect(patient).toMatchObject({ name: "María José López", firstName: "María José", lastName: "López" });

    const updated = await updatePatient(clinicA.id, patient.id, {
      firstName: "María José",
      lastName: "López Díaz",
      phone: "1",
    });
    expect(updated.name).toBe("María José López Díaz");
  });

  it("splits a full name given in one field (quick add from a turno, imports)", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    expect(patient).toMatchObject({ name: "Ana Gómez", firstName: "Ana", lastName: "Gómez" });
  });

  it("refuses a patient with no name at all", async () => {
    await expect(createPatient(clinicA.id, { firstName: " ", lastName: "", phone: "1" })).rejects.toThrow(
      "Ingresá el nombre del paciente",
    );
  });

  it("stores the obra social, fiscal, emergency, medical and origin details", async () => {
    const patient = await createPatient(clinicA.id, {
      firstName: "Ana",
      lastName: "Gómez",
      phone: "1",
      gender: "femenino",
      active: false,
      city: "Rosario",
      province: "Santa Fe",
      insurancePlan: "210",
      insuranceHolder: "Juan Gómez",
      holderRelationship: "Hija",
      familyGroup: "4",
      holderWorkplace: "Municipalidad",
      taxId: "27-12345678-3",
      taxName: "Ana Gómez SRL",
      ivaCondition: "monotributo",
      emergencyName: "Juan Gómez",
      emergencyPhone: "11 2222-3333",
      emergencyRelation: "Padre",
      bloodType: "0+",
      bloodPressure: "120/80",
      medicalHistory: "Operada de apendicitis",
      referralSource: "recomendacion",
      acceptsReminders: false,
      internalNotes: "Prefiere turnos a la tarde",
    });
    expect(patient).toMatchObject({
      gender: "femenino",
      active: false,
      city: "Rosario",
      insuranceHolder: "Juan Gómez",
      taxId: "27-12345678-3",
      ivaCondition: "monotributo",
      emergencyPhone: "11 2222-3333",
      bloodType: "0+",
      medicalHistory: "Operada de apendicitis",
      referralSource: "recomendacion",
      acceptsReminders: false,
      internalNotes: "Prefiere turnos a la tarde",
    });
  });

  it("is active and accepts reminders unless told otherwise", async () => {
    const patient = await createPatient(clinicA.id, { name: "Ana Gómez", phone: "1" });
    expect(patient.active).toBe(true);
    expect(patient.acceptsReminders).toBe(true);
  });
});
