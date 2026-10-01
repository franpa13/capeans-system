import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";

afterEach(async () => {
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("prisma schema", () => {
  it("creates a clinic, a patient under it, and a consultation under the patient", async () => {
    const clinic = await prisma.clinic.create({
      data: { clerkOrgId: "org_test_1", name: "Clínica de prueba" },
    });
    const patient = await prisma.patient.create({
      data: { clinicId: clinic.id, name: "Paciente Test", phone: "111" },
    });
    const consultation = await prisma.consultation.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
      },
    });

    expect(consultation.patientId).toBe(patient.id);
  });

  it("sets consultation.patientId to null (not a delete or an error) when the patient is deleted", async () => {
    const clinic = await prisma.clinic.create({
      data: { clerkOrgId: "org_test_2", name: "Clínica de prueba 2" },
    });
    const patient = await prisma.patient.create({
      data: { clinicId: clinic.id, name: "Paciente Test", phone: "111" },
    });
    const consultation = await prisma.consultation.create({
      data: {
        clinicId: clinic.id,
        patientId: patient.id,
        date: new Date("2026-01-01"),
        treatment: "Limpieza",
      },
    });

    await prisma.patient.delete({ where: { id: patient.id } });

    const result = await prisma.consultation.findUniqueOrThrow({
      where: { id: consultation.id },
    });
    expect(result.patientId).toBeNull();
  });
});
