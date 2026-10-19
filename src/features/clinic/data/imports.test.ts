import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createPatient, getPatients } from "@/features/clinic/data/patients";
import { createSupply, getSupplies } from "@/features/clinic/data/supplies";
import { createClinicOption, getClinicOptions } from "@/features/clinic/data/clinic-options";
import { importPatients, importSupplies, importTreatments } from "@/features/clinic/data/imports";

let clinicA: { id: string };
let clinicB: { id: string };

beforeEach(async () => {
  clinicA = await prisma.clinic.create({ data: { clerkOrgId: `org_a_${Date.now()}`, name: "A" } });
  clinicB = await prisma.clinic.create({ data: { clerkOrgId: `org_b_${Date.now()}`, name: "B" } });
});

afterEach(async () => {
  await prisma.patient.deleteMany({});
  await prisma.supply.deleteMany({});
  await prisma.clinicOption.deleteMany({});
  await prisma.clinic.deleteMany({});
});

describe("importPatients", () => {
  it("creates new patients and skips ones already loaded (same DNI, or same name and phone)", async () => {
    await createPatient(clinicA.id, { name: "Ana", phone: "111", dni: "30" });
    await createPatient(clinicA.id, { name: "Beto", phone: "222" });
    // Another clinic's patients don't count as duplicates.
    await createPatient(clinicB.id, { name: "Carla", phone: "333" });

    const result = await importPatients(clinicA.id, [
      { rowNumber: 2, input: { name: "Ana María", phone: "999", dni: "30" } },
      { rowNumber: 3, input: { name: "beto", phone: "222" } },
      { rowNumber: 4, input: { name: "Carla", phone: "333" } },
      { rowNumber: 5, input: { name: "Carla", phone: "333" } },
    ]);

    expect(result.created).toBe(1);
    expect(result.skipped).toEqual([
      { row: 2, message: "Ya existe un paciente con el DNI 30" },
      { row: 3, message: "Ya existe beto con ese teléfono" },
      { row: 5, message: "Ya existe Carla con ese teléfono" },
    ]);
    expect((await getPatients(clinicA.id)).map((p) => p.name).sort()).toEqual(["Ana", "Beto", "Carla"]);
  });
});

describe("importSupplies", () => {
  it("creates new insumos and skips names that already exist", async () => {
    await createSupply(clinicA.id, { name: "Guantes", unit: "caja" });
    const result = await importSupplies(clinicA.id, [
      { rowNumber: 2, input: { name: "Guantes", unit: "caja", quantity: 5 } },
      { rowNumber: 3, input: { name: "Anestesia", unit: "ampolla", price: 800, quantity: 40 } },
    ]);
    expect(result).toMatchObject({ created: 1, skipped: [{ row: 2, message: "Ya existe Guantes" }] });
    const anestesia = (await getSupplies(clinicA.id)).find((s) => s.name === "Anestesia")!;
    expect(anestesia).toMatchObject({ unit: "ampolla", price: 800, quantity: 40 });
  });
});

describe("importTreatments", () => {
  it("creates new tratamientos and updates the price of existing ones", async () => {
    await createClinicOption(clinicA.id, "treatment", "Limpieza", 10000);
    const result = await importTreatments(clinicA.id, [
      { rowNumber: 2, input: { label: "Limpieza", price: 12000 } },
      { rowNumber: 3, input: { label: "Blanqueamiento", price: 50000 } },
      { rowNumber: 4, input: { label: "Limpieza", price: undefined } },
    ]);
    expect(result).toMatchObject({ created: 1, updated: 1, skipped: [{ row: 4, message: "Limpieza ya existe (sin precio para actualizar)" }] });
    const options = await getClinicOptions(clinicA.id, "treatment");
    expect(options.map((o) => [o.label, o.price]).sort()).toEqual([
      ["Blanqueamiento", 50000],
      ["Limpieza", 12000],
    ]);
  });
});
