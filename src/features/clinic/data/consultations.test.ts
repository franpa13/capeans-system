import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  createConsultation,
  getConsultation,
  getConsultations,
  getConsultationsForPatient,
} from "@/features/clinic/data/consultations";

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

describe("consultations data layer", () => {
  it("creates a consultation scoped to the given clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.clinicId).toBe(clinicA.id);
  });

  it("persists multiple teeth on a single consultation", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      teeth: ["16", "17", "26"],
    });
    expect(consultation.teeth).toEqual(["16", "17", "26"]);
  });

  it("defaults to an empty teeth array when none is given", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    expect(consultation.teeth).toEqual([]);
  });

  it("does not return a clinic A consultation when queried with clinic B's id", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const consultation = await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    const result = await getConsultation(clinicB.id, consultation.id);
    expect(result).toBeNull();
  });

  it("lists only consultations belonging to the requested clinic", async () => {
    const patientA = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const patientB = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });
    await createConsultation(clinicA.id, {
      patientId: patientA.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    await createConsultation(clinicB.id, {
      patientId: patientB.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
    });

    const listA = await getConsultations(clinicA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0].treatment).toBe("Limpieza");
  });

  it("returns only the given patient's consultations, scoped to the clinic", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const otherPatient = await createPatient(clinicA.id, { name: "Paciente B", phone: "222" });
    await createConsultation(clinicA.id, {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
    });
    await createConsultation(clinicA.id, {
      patientId: otherPatient.id,
      date: new Date("2026-01-02"),
      treatment: "Extracción",
    });

    const result = await getConsultationsForPatient(clinicA.id, patient.id);
    expect(result).toHaveLength(1);
    expect(result[0].treatment).toBe("Limpieza");
  });

  it("ignores a clinicId injected into the create input, using the argument instead", async () => {
    const patient = await createPatient(clinicA.id, { name: "Paciente A", phone: "111" });
    const injected = {
      patientId: patient.id,
      date: new Date("2026-01-01"),
      treatment: "Limpieza",
      clinicId: clinicB.id,
    } as Parameters<typeof createConsultation>[1];

    const consultation = await createConsultation(clinicA.id, injected);

    expect(consultation.clinicId).toBe(clinicA.id);
  });

  it("refuses to create a consultation for a patient belonging to another clinic", async () => {
    const otherClinicPatient = await createPatient(clinicB.id, { name: "Paciente B", phone: "222" });

    await expect(
      createConsultation(clinicA.id, {
        patientId: otherClinicPatient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
      }),
    ).rejects.toThrow("Patient not found for this clinic");
  });
});
