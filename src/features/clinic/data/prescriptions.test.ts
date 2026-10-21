import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient } from "@/features/clinic/data/patients";
import {
  createProfessional,
  deleteProfessional,
  getProfessionals,
  updateProfessional,
} from "@/features/clinic/data/professionals";
import {
  createPrescription,
  deletePrescription,
  getPatientPrescriptions,
  getPrescription,
} from "@/features/clinic/data/prescriptions";
import { updateClinicDetails } from "@/features/clinic/data/clinic-details";

const SIGNATURE = "data:image/png;base64,iVBORw0KGgo=";
const amoxi = { drug: "Amoxicilina", concentration: "500 mg", quantity: "21", instructions: "1 cada 8 h" };

let clinicA: { id: string };
let clinicB: { id: string };
let patientId: string;

beforeEach(async () => {
  clinicA = await prisma.clinic.create({
    data: { clerkOrgId: `org_a_${Date.now()}`, name: "Clínica A" },
  });
  clinicB = await prisma.clinic.create({
    data: { clerkOrgId: `org_b_${Date.now()}`, name: "Clínica B" },
  });
  patientId = (await createPatient(clinicA.id, { name: "Leonardo Aguirre", phone: "1" })).id;
});

afterEach(async () => {
  await prisma.prescription.deleteMany({});
  await prisma.professional.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.clinic.deleteMany({});
});

const dra = (overrides = {}) => ({
  title: "Dra.",
  name: " Valeria Moretti ",
  specialty: "Odontopediatría",
  license: " MP 41236 ",
  signature: SIGNATURE,
  ...overrides,
});

describe("professionals", () => {
  it("are created trimmed and listed by name", async () => {
    await createProfessional(clinicA.id, dra());
    await createProfessional(clinicA.id, dra({ title: "Dr.", name: "Andrés Benítez", signature: null }));
    const list = await getProfessionals(clinicA.id);
    expect(list.map((p) => [p.title, p.name, p.license, !!p.signature])).toEqual([
      ["Dr.", "Andrés Benítez", "MP 41236", false],
      ["Dra.", "Valeria Moretti", "MP 41236", true],
    ]);
    expect(await getProfessionals(clinicB.id)).toEqual([]);
  });

  it("need a name, a matrícula, a known title and an image signature", async () => {
    await expect(createProfessional(clinicA.id, dra({ name: " " }))).rejects.toThrow("Ingresá el nombre");
    await expect(createProfessional(clinicA.id, dra({ license: "" }))).rejects.toThrow("Ingresá la matrícula");
    await expect(createProfessional(clinicA.id, dra({ title: "Sr." }))).rejects.toThrow("Elegí el título");
    await expect(createProfessional(clinicA.id, dra({ signature: "javascript:alert(1)" }))).rejects.toThrow(
      "La firma no es válida",
    );
  });

  it("are edited and deleted only within their clinic", async () => {
    const p = await createProfessional(clinicA.id, dra());
    await expect(updateProfessional(clinicB.id, p.id, dra({ name: "X" }))).rejects.toThrow();
    const edited = await updateProfessional(clinicA.id, p.id, dra({ license: "MN 99", signature: null }));
    expect(edited).toMatchObject({ license: "MN 99", signature: null });
    await expect(deleteProfessional(clinicB.id, p.id)).rejects.toThrow();
    await deleteProfessional(clinicA.id, p.id);
    expect(await getProfessionals(clinicA.id)).toEqual([]);
  });
});

describe("clinic details", () => {
  it("saves the address, phone and email for the letterhead", async () => {
    const clinic = await updateClinicDetails(clinicA.id, {
      address: " San Juan 3169, Rosario ",
      phone: "341 232-3232",
      email: "",
    });
    expect(clinic).toMatchObject({ address: "San Juan 3169, Rosario", phone: "341 232-3232", email: null });
  });
});

describe("prescriptions", () => {
  it("numbers recetas per clinic and copies the professional in as they were", async () => {
    const pro = await createProfessional(clinicA.id, dra());
    const first = await createPrescription(clinicA.id, patientId, {
      professionalId: pro.id,
      items: [amoxi],
      treatment: " Extracción ",
      instructions: " Dieta blanda ",
    });
    const second = await createPrescription(clinicA.id, patientId, { professionalId: pro.id, items: [amoxi] });
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(first).toMatchObject({
      treatment: "Extracción",
      instructions: "Dieta blanda",
      professionalTitle: "Dra.",
      professionalName: "Valeria Moretti",
      professionalLicense: "MP 41236",
      professionalSignature: SIGNATURE,
    });

    // Editing the profile later doesn't rewrite what was issued.
    await updateProfessional(clinicA.id, pro.id, dra({ license: "MN 1" }));
    expect((await getPrescription(clinicA.id, first.id))!.professionalLicense).toBe("MP 41236");

    const other = await createPatient(clinicB.id, { name: "Otra", phone: "2" });
    const proB = await createProfessional(clinicB.id, dra());
    const fromB = await createPrescription(clinicB.id, other.id, { professionalId: proB.id, items: [amoxi] });
    expect(fromB.number).toBe(1);
  });

  it("keeps only medications with a name, and needs at least one", async () => {
    const pro = await createProfessional(clinicA.id, dra());
    await expect(
      createPrescription(clinicA.id, patientId, { professionalId: pro.id, items: [{ ...amoxi, drug: " " }] }),
    ).rejects.toThrow("Agregá al menos un medicamento");
    const p = await createPrescription(clinicA.id, patientId, {
      professionalId: pro.id,
      items: [{ drug: " Ibuprofeno ", concentration: " 400 mg ", quantity: "", instructions: "" }, { ...amoxi, drug: "" }],
    });
    expect(p.items).toEqual([{ drug: "Ibuprofeno", concentration: "400 mg", quantity: "", instructions: "" }]);
  });

  it("can't use another clinic's patient or professional, nor read or delete its recetas", async () => {
    const pro = await createProfessional(clinicA.id, dra());
    const proB = await createProfessional(clinicB.id, dra());
    await expect(
      createPrescription(clinicA.id, patientId, { professionalId: proB.id, items: [amoxi] }),
    ).rejects.toThrow();
    await expect(createPrescription(clinicB.id, patientId, { professionalId: proB.id, items: [amoxi] })).rejects.toThrow();

    const p = await createPrescription(clinicA.id, patientId, { professionalId: pro.id, items: [amoxi] });
    expect(await getPrescription(clinicB.id, p.id)).toBeNull();
    expect(await getPatientPrescriptions(clinicB.id, patientId)).toEqual([]);
    await expect(deletePrescription(clinicB.id, p.id)).rejects.toThrow();
    await deletePrescription(clinicA.id, p.id);
    expect(await getPatientPrescriptions(clinicA.id, patientId)).toEqual([]);
  });

  it("survives its professional being deleted", async () => {
    const pro = await createProfessional(clinicA.id, dra());
    const p = await createPrescription(clinicA.id, patientId, { professionalId: pro.id, items: [amoxi] });
    await deleteProfessional(clinicA.id, pro.id);
    expect(await getPrescription(clinicA.id, p.id)).toMatchObject({
      professionalId: null,
      professionalName: "Valeria Moretti",
    });
  });
});
