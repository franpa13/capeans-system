import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import { createProfessional, deleteProfessional, updateProfessional } from "@/features/clinic/data/professionals";
import {
  createMedicalOrder,
  deleteMedicalOrder,
  getMedicalOrder,
  getPatientMedicalOrders,
} from "@/features/clinic/data/medical-orders";

const dra = {
  title: "Dra.",
  name: "Valeria Moretti",
  specialty: "Cirugía",
  license: "MP 41236",
  signature: "data:image/png;base64,iVBORw0KGgo=",
};

let clinicA: { id: string };
let clinicB: { id: string };
let patientId: string;
let professionalId: string;

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" } });
  patientId = (await createPatient(clinicA.id, { name: "Leonardo Aguirre", phone: "1" })).id;
  professionalId = (await createProfessional(clinicA.id, dra)).id;
});

afterEach(async () => {
  await prisma.medicalOrder.deleteMany({});
  await prisma.professional.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("medical orders (órdenes)", () => {
  it("numbers órdenes per clinic, keeps the lines asked for and copies the professional in", async () => {
    const first = await createMedicalOrder(clinicA.id, patientId, {
      professionalId,
      kind: "imagenes",
      items: [" Radiografía panorámica ", "", "Radiografía periapical de la pieza 16"],
      diagnosis: " Terceros molares ",
      notes: "",
    });
    const second = await createMedicalOrder(clinicA.id, patientId, {
      professionalId,
      kind: "laboratorio",
      items: ["Coagulograma (TP, KPTT, RIN)"],
    });
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first).toMatchObject({
      kind: "imagenes",
      items: ["Radiografía panorámica", "Radiografía periapical de la pieza 16"],
      diagnosis: "Terceros molares",
      notes: null,
      professionalName: "Valeria Moretti",
      professionalLicense: "MP 41236",
    });

    await updateProfessional(clinicA.id, professionalId, { ...dra, license: "MN 1" });
    expect((await getMedicalOrder(clinicA.id, first.id))!.professionalLicense).toBe("MP 41236");
    expect((await getPatientMedicalOrders(clinicA.id, patientId)).map((o) => o.number)).toEqual([2, 1]);
  });

  it("needs a known kind and at least one line", async () => {
    await expect(
      createMedicalOrder(clinicA.id, patientId, { professionalId, kind: "receta", items: ["x"] }),
    ).rejects.toThrow("Elegí el tipo de orden");
    await expect(
      createMedicalOrder(clinicA.id, patientId, { professionalId, kind: "imagenes", items: [" "] }),
    ).rejects.toThrow("Agregá al menos un estudio o derivación");
  });

  it("can't use another clinic's patient or professional, nor read or delete its órdenes", async () => {
    const proB = await createProfessional(clinicB.id, dra);
    const input = { kind: "laboratorio", items: ["Hemograma completo"] };
    await expect(createMedicalOrder(clinicA.id, patientId, { ...input, professionalId: proB.id })).rejects.toThrow();
    await expect(createMedicalOrder(clinicB.id, patientId, { ...input, professionalId: proB.id })).rejects.toThrow();

    const order = await createMedicalOrder(clinicA.id, patientId, { ...input, professionalId });
    expect(await getMedicalOrder(clinicB.id, order.id)).toBeNull();
    expect(await getPatientMedicalOrders(clinicB.id, patientId)).toEqual([]);
    await expect(deleteMedicalOrder(clinicB.id, order.id)).rejects.toThrow();
    await deleteMedicalOrder(clinicA.id, order.id);
    expect(await getPatientMedicalOrders(clinicA.id, patientId)).toEqual([]);
  });

  it("survives its professional being deleted", async () => {
    const order = await createMedicalOrder(clinicA.id, patientId, {
      professionalId,
      kind: "derivacion",
      items: ["Derivación a endodoncia"],
    });
    await deleteProfessional(clinicA.id, professionalId);
    expect(await getMedicalOrder(clinicA.id, order.id)).toMatchObject({
      professionalId: null,
      professionalName: "Valeria Moretti",
    });
  });
});
